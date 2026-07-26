"""ワーカーの設定。環境変数(必要なら worker/.env)から読み込む。"""

from __future__ import annotations

import os
import socket
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # worker/.env があれば読み込む

# .../segnote/src
REPO_SRC = Path(__file__).resolve().parents[1]

DATABASE_URL = os.environ.get("DATABASE_URL")

# NextJS の lib/storage.ts と同じ既定値(src/storage)を指すこと。
# 同一ホストか共有ボリュームでこのディレクトリを共有している前提。
STORAGE_DIR = Path(
    os.environ.get("SEGNOTE_STORAGE_DIR") or (REPO_SRC / "storage")
).resolve()

# 同時に処理するジョブ数。GPU/CPU の実効的な並列度に合わせて調整する。
WORKER_CONCURRENCY = int(os.environ.get("SEGNOTE_WORKER_CONCURRENCY", "2"))

# 処理待ちジョブが無いときのポーリング間隔(秒)。
POLL_INTERVAL_SEC = float(os.environ.get("SEGNOTE_WORKER_POLL_INTERVAL", "5"))

# RUNNING のまま放置されたジョブ(ワーカークラッシュ等)を PENDING に戻すまでの猶予(秒)。
STALE_JOB_TIMEOUT_SEC = float(os.environ.get("SEGNOTE_STALE_JOB_TIMEOUT", "1800"))

# このワーカーインスタンスの識別子(ジョブの lockedBy に入る)。
WORKER_ID = os.environ.get("SEGNOTE_WORKER_ID") or f"{socket.gethostname()}:{os.getpid()}"


def resolve_blob_path(blob_url: str) -> Path:
    """Recording.blobUrl(ストレージキー)を実体パスに解決する。STORAGE_DIR 外は拒否。"""
    full = (STORAGE_DIR / blob_url).resolve()
    if full != STORAGE_DIR and STORAGE_DIR not in full.parents:
        raise ValueError(f"blobUrl escapes storage dir: {blob_url!r}")
    return full
