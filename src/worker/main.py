"""Segnote ワーカー本体。

DB のジョブテーブルをポーリングし、PENDING のジョブを掴んでパイプラインを回す常駐プロセス。
GPU/CPU を活かすため複数スレッドで並列に処理する。各スレッドは自分専用の DB 接続を持ち、
`FOR UPDATE SKIP LOCKED` で互いに別のジョブを掴む。
"""

from __future__ import annotations

import logging
import threading
import time

import config
import db
import pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(threadName)s] %(name)s: %(message)s",
)
logger = logging.getLogger("segnote.worker")

_stop = threading.Event()


def process_job(conn: "db.psycopg.Connection", job: db.Job) -> None:
    """1件のジョブを処理し、結果に応じてジョブの状態を更新する。"""
    recording = db.load_recording(conn, job.recording_uuid)
    audio_path = config.resolve_blob_path(recording.blob_url)
    if not audio_path.exists():
        raise FileNotFoundError(f"blob missing: {audio_path}")

    ctx = pipeline.StageContext(
        conn=conn, job=job, recording=recording, audio_path=audio_path
    )
    logger.info(
        "start job=%s recording=%s attempt=%d/%d version=%s",
        job.uuid, recording.id, job.attempts, job.max_attempts, job.pipeline_version,
    )
    try:
        stage_runs = pipeline.run_pipeline(ctx)
    except Exception as e:
        # run_pipeline が積み上げた stageRuns を残したいので取り直す。
        _, current_runs = _current_stage_runs(conn, job.uuid)
        status = db.mark_failed_or_retry(
            conn, job, current_runs, f"{type(e).__name__}: {e}"
        )
        logger.exception("job %s failed -> %s", job.uuid, status)
        return

    db.mark_done(conn, job, stage_runs)
    logger.info("done job=%s recording=%s", job.uuid, recording.id)


def _current_stage_runs(conn: "db.psycopg.Connection", job_uuid: str):
    with conn.cursor() as cur:
        cur.execute(
            'SELECT stage, "stageRuns" FROM "ProcessingJob" WHERE uuid = %s',
            (job_uuid,),
        )
        row = cur.fetchone()
    if row is None:
        return None, []
    return row[0], (row[1] or [])


def worker_loop(worker_index: int) -> None:
    """1スレッドぶんの処理ループ。ジョブが無ければ待ってから再ポーリングする。"""
    assert config.DATABASE_URL is not None
    conn = db.connect(config.DATABASE_URL)
    logger.info("worker %d connected as %s", worker_index, config.WORKER_ID)
    try:
        while not _stop.is_set():
            try:
                job = db.claim_job(conn, config.WORKER_ID)
            except Exception:
                logger.exception("claim failed; reconnecting")
                conn = _reconnect(conn)
                _stop.wait(config.POLL_INTERVAL_SEC)
                continue

            if job is None:
                _stop.wait(config.POLL_INTERVAL_SEC)
                continue

            try:
                process_job(conn, job)
            except Exception:
                # process_job 内で処理し切れなかった致命的エラー。ジョブを戻して継続。
                logger.exception("unhandled error on job %s", job.uuid)
                try:
                    db.mark_failed_or_retry(conn, job, [], "unhandled worker error")
                except Exception:
                    conn = _reconnect(conn)
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _reconnect(conn: "db.psycopg.Connection") -> "db.psycopg.Connection":
    try:
        conn.close()
    except Exception:
        pass
    assert config.DATABASE_URL is not None
    return db.connect(config.DATABASE_URL)


def _janitor_loop() -> None:
    """クラッシュ等で RUNNING のまま残ったジョブを定期的に PENDING へ戻す。"""
    assert config.DATABASE_URL is not None
    conn = db.connect(config.DATABASE_URL)
    try:
        while not _stop.is_set():
            try:
                n = db.requeue_stale_jobs(conn, config.STALE_JOB_TIMEOUT_SEC)
                if n:
                    logger.warning("requeued %d stale job(s)", n)
            except Exception:
                logger.exception("janitor error")
                conn = _reconnect(conn)
            _stop.wait(config.STALE_JOB_TIMEOUT_SEC)
    finally:
        conn.close()


def main() -> None:
    if not config.DATABASE_URL:
        raise SystemExit("DATABASE_URL is not set")

    logger.info(
        "starting worker id=%s concurrency=%d storage=%s pipeline=%s",
        config.WORKER_ID,
        config.WORKER_CONCURRENCY,
        config.STORAGE_DIR,
        pipeline.CURRENT_PIPELINE_VERSION,
    )

    threads: list[threading.Thread] = []
    janitor = threading.Thread(target=_janitor_loop, name="janitor", daemon=True)
    janitor.start()
    threads.append(janitor)

    for i in range(config.WORKER_CONCURRENCY):
        t = threading.Thread(target=worker_loop, args=(i,), name=f"worker-{i}", daemon=True)
        t.start()
        threads.append(t)

    try:
        while not _stop.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        logger.info("shutting down...")
        _stop.set()
        for t in threads:
            t.join(timeout=10)


if __name__ == "__main__":
    main()
