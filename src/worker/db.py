"""ジョブキューとしての PostgreSQL 操作。

Prisma のマイグレーションで作られたテーブルを、ワーカーからは生SQLで直接触る。
FastAPI 等の HTTP レイヤは挟まず、DB をジョブの受け渡しに使う設計
(src/README.md「nextjsとPythonで書かれたジョブのワーカーとの連携」)。

複数ワーカー/スレッドが安全に並列化できるよう、ジョブの取得は
`FOR UPDATE SKIP LOCKED` で1件ずつアトミックに掴む。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.types.json import Jsonb


@dataclass
class Job:
    uuid: str
    recording_uuid: str
    pipeline_version: str
    attempts: int
    max_attempts: int
    stage_runs: list[dict[str, Any]]


@dataclass
class Recording:
    uuid: str
    id: str
    team_uuid: str
    title: str
    blob_url: str
    target_pipeline_version: str


def connect(database_url: str) -> psycopg.Connection:
    # スレッドごとに1接続。autocommit=False で claim をトランザクションにする。
    return psycopg.connect(database_url, autocommit=False)


def requeue_stale_jobs(conn: psycopg.Connection, timeout_sec: float) -> int:
    """RUNNING のまま放置された(ワーカーが落ちた等)ジョブを PENDING に戻す。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "ProcessingJob"
            SET status = 'PENDING', "lockedBy" = NULL, "lockedAt" = NULL,
                "updatedAt" = now()
            WHERE status = 'RUNNING'
              AND "lockedAt" < now() - make_interval(secs => %(timeout)s)
              AND attempts < "maxAttempts"
            """,
            {"timeout": timeout_sec},
        )
        n = cur.rowcount
    conn.commit()
    return n


def claim_job(conn: psycopg.Connection, worker_id: str) -> Job | None:
    """PENDING のジョブを1件だけアトミックに掴んで RUNNING にする。無ければ None。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "ProcessingJob" AS j
            SET status = 'RUNNING',
                "lockedBy" = %(worker)s,
                "lockedAt" = now(),
                "startedAt" = COALESCE(j."startedAt", now()),
                attempts = j.attempts + 1,
                "updatedAt" = now()
            WHERE j.uuid = (
                SELECT uuid FROM "ProcessingJob"
                WHERE status = 'PENDING' AND attempts < "maxAttempts"
                ORDER BY "createdAt"
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING j.uuid, j."recordingUuid", j."pipelineVersion",
                      j.attempts, j."maxAttempts", j."stageRuns"
            """,
            {"worker": worker_id},
        )
        row = cur.fetchone()
    conn.commit()  # 掴んだ結果を確定してロックを解放(他ワーカーは status で弾かれる)
    if row is None:
        return None
    return Job(
        uuid=row[0],
        recording_uuid=row[1],
        pipeline_version=row[2],
        attempts=row[3],
        max_attempts=row[4],
        stage_runs=row[5] or [],
    )


def load_recording(conn: psycopg.Connection, recording_uuid: str) -> Recording:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT uuid, id, "teamUuid", title, "blobUrl", "targetPipelineVersion"
            FROM "Recording" WHERE uuid = %(uuid)s
            """,
            {"uuid": recording_uuid},
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError(f"Recording not found: {recording_uuid}")
    return Recording(*row)


def update_stage(
    conn: psycopg.Connection,
    job_uuid: str,
    stage: str,
    stage_runs: list[dict[str, Any]],
) -> None:
    """現在のステージと実行記録(JSON)を保存する。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "ProcessingJob"
            SET stage = %(stage)s, "stageRuns" = %(runs)s, "updatedAt" = now()
            WHERE uuid = %(uuid)s
            """,
            {"stage": stage, "runs": Jsonb(stage_runs), "uuid": job_uuid},
        )
    conn.commit()


def mark_done(
    conn: psycopg.Connection,
    job: Job,
    stage_runs: list[dict[str, Any]],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "ProcessingJob"
            SET status = 'DONE', error = NULL, "stageRuns" = %(runs)s,
                "lockedBy" = NULL, "lockedAt" = NULL,
                "finishedAt" = now(), "updatedAt" = now()
            WHERE uuid = %(uuid)s
            """,
            {"runs": Jsonb(stage_runs), "uuid": job.uuid},
        )
        # どのバージョンで処理し切ったかを Recording にも焼き込む。
        cur.execute(
            """
            UPDATE "Recording"
            SET "processedPipelineVersion" = %(version)s
            WHERE uuid = %(rec)s
            """,
            {"version": job.pipeline_version, "rec": job.recording_uuid},
        )
    conn.commit()


def mark_failed_or_retry(
    conn: psycopg.Connection,
    job: Job,
    stage_runs: list[dict[str, Any]],
    error: str,
) -> str:
    """試行回数を使い切っていれば FAILED、まだなら PENDING に戻して再試行させる。"""
    exhausted = job.attempts >= job.max_attempts
    new_status = "FAILED" if exhausted else "PENDING"
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "ProcessingJob"
            SET status = %(status)s, error = %(error)s, "stageRuns" = %(runs)s,
                "lockedBy" = NULL, "lockedAt" = NULL,
                "finishedAt" = CASE WHEN %(status)s = 'FAILED' THEN now() ELSE NULL END,
                "updatedAt" = now()
            WHERE uuid = %(uuid)s
            """,
            {
                "status": new_status,
                "error": error[:2000],
                "runs": Jsonb(stage_runs),
                "uuid": job.uuid,
            },
        )
    conn.commit()
    return new_status


def replace_segments(
    conn: psycopg.Connection,
    recording_uuid: str,
    segments: list[dict[str, Any]],
) -> None:
    """区間分割の結果で Segment を置き換える。type は 'SPEECH' | 'MUSIC'。"""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "Segment" WHERE "recordingUuid" = %(rec)s',
            {"rec": recording_uuid},
        )
        for i, seg in enumerate(segments):
            cur.execute(
                """
                INSERT INTO "Segment" (id, "recordingUuid", type, start, "end")
                VALUES (%(id)s, %(rec)s, %(type)s, %(start)s, %(end)s)
                """,
                {
                    "id": i,
                    "rec": recording_uuid,
                    "type": seg["type"],
                    "start": seg["start"],
                    "end": seg["end"],
                },
            )
    conn.commit()


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
