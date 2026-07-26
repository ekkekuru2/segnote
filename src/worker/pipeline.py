"""パイプラインのステージ定義と実行。

src/README.md「各録音のパイプライン処理について」に対応する:
  1. segmentation  : inaSpeechSegmenter で speech/music/その他 に分割     (実装済み)
  2. normalization : music/speech 区間の音量調節                          (TODO)
  3. transcription : speech 区間の whisper 文字起こし                      (TODO)
  4. matching      : music 区間を参考音源と紐付け / 曲名判定              (TODO)

ステージ構成や各ステージのモデルは変わりうる。どのバージョンで処理したかを追えるよう、
各ステージは (stage id, processor 名, version) を持ち、実行記録を ProcessingJob.stageRuns
に残す。バージョンを上げるときは CURRENT_PIPELINE_VERSION も上げること。

!!! NextJS 側の lib/pipeline.ts の CURRENT_PIPELINE_VERSION と揃えること !!!
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import psycopg

import db
import segmentation

CURRENT_PIPELINE_VERSION = "v1"

logger = logging.getLogger("segnote.pipeline")


@dataclass
class StageContext:
    conn: psycopg.Connection
    job: db.Job
    recording: db.Recording
    audio_path: Path


@dataclass
class Stage:
    id: str  # ステージ識別子(stageRuns / ProcessingJob.stage に入る)
    processor: str  # 使用する実装/モデル名
    version: str  # そのステージ実装のバージョン
    run: Callable[[StageContext], None]


# --- 各ステージの実装 -------------------------------------------------------


def _run_segmentation(ctx: StageContext) -> None:
    segments = segmentation.segment(str(ctx.audio_path))
    db.replace_segments(ctx.conn, ctx.recording.uuid, segments)
    logger.info("segmentation: %d segments for %s", len(segments), ctx.recording.id)


def _run_normalization(ctx: StageContext) -> None:
    # TODO: music 区間を相対音量を保ったまま最大が0dBになるよう上げ、
    #       speech 区間を聴きやすい音量にノーマライズする(src/README.md ステップ2)。
    logger.info("normalization: not implemented yet (skipped) for %s", ctx.recording.id)


def _run_transcription(ctx: StageContext) -> None:
    # TODO: SPEECH 区間を whisper で文字起こしし、Segment.text を更新する。
    logger.info("transcription: not implemented yet (skipped) for %s", ctx.recording.id)


def _run_matching(ctx: StageContext) -> None:
    # TODO: MUSIC 区間を参考音源(Reference)と紐付け、Segment.reference/refStart/refEnd を埋める。
    #       ヒットした Reference の多数決で曲名を決め、Recording.title / id を確定する
    #       (src/README.md「recordingIdは...曲名から決定する」)。
    #       /home/ekkekuru2/workdir/inaspeechsegmenter_test/src/music_detection.py を参考に。
    logger.info("matching: not implemented yet (skipped) for %s", ctx.recording.id)


# --- バージョンごとのステージ列 --------------------------------------------

_STAGES_BY_VERSION: dict[str, list[Stage]] = {
    "v1": [
        Stage("segmentation", segmentation.PROCESSOR_NAME, "0.8.0", _run_segmentation),
        Stage("normalization", "TODO", "0", _run_normalization),
        Stage("transcription", "whisper-TODO", "0", _run_transcription),
        Stage("matching", "TODO", "0", _run_matching),
    ],
}


def stages_for(pipeline_version: str) -> list[Stage]:
    if pipeline_version not in _STAGES_BY_VERSION:
        raise ValueError(f"unknown pipeline version: {pipeline_version}")
    return _STAGES_BY_VERSION[pipeline_version]


def run_pipeline(ctx: StageContext) -> list[dict[str, Any]]:
    """ジョブのステージを順に実行し、stageRuns(実行記録)を返す。

    途中のステージで例外が出たら、そこまでの記録を残して例外を送出する
    (呼び出し側が再試行/失敗のハンドリングを行う)。
    """
    stages = stages_for(ctx.job.pipeline_version)
    stage_runs: list[dict[str, Any]] = []

    for stage in stages:
        run_record: dict[str, Any] = {
            "stage": stage.id,
            "processor": stage.processor,
            "version": stage.version,
            "status": "running",
            "startedAt": db.utcnow_iso(),
            "finishedAt": None,
            "error": None,
        }
        stage_runs.append(run_record)
        # 現在のステージを可視化(UI のステータス表示にも使われる)。
        db.update_stage(ctx.conn, ctx.job.uuid, stage.id, stage_runs)

        try:
            stage.run(ctx)
        except Exception as e:
            run_record["status"] = "failed"
            run_record["finishedAt"] = db.utcnow_iso()
            run_record["error"] = f"{type(e).__name__}: {e}"
            raise
        else:
            run_record["status"] = "done"
            run_record["finishedAt"] = db.utcnow_iso()
            db.update_stage(ctx.conn, ctx.job.uuid, stage.id, stage_runs)

    return stage_runs
