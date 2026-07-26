# segnote worker

録音を処理する Python の常駐ワーカー。HTTP は持たず、PostgreSQL のジョブテーブル
(`ProcessingJob`)をポーリングして、PENDING のジョブを掴んでパイプラインを回す。

## 構成

| ファイル          | 役割 |
| ----------------- | ---- |
| `main.py`         | ワーカー本体。複数スレッドで並列にジョブを処理する常駐ループ |
| `db.py`           | ジョブキュー操作(`FOR UPDATE SKIP LOCKED` で掴む生SQL) |
| `pipeline.py`     | ステージ定義と実行。バージョンごとのステージ列を持つ |
| `segmentation.py` | ステージ1: inaSpeechSegmenter による区間分割(実装済み) |
| `config.py`       | 環境変数からの設定読み込み |

## パイプライン(src/README.md 準拠)

1. **segmentation** — speech/music/その他 に分割 … 実装済み
2. **normalization** — 音量調節 … TODO
3. **transcription** — whisper 文字起こし … TODO
4. **matching** — 参考音源との紐付け・曲名判定 … TODO

ステージ構成やモデルは変わりうるので、各ジョブがどのバージョンで処理されたかを
`ProcessingJob.pipelineVersion` / `stageRuns` と `Recording.processed/targetPipelineVersion`
で追跡する。バージョンを上げるときは `pipeline.py` の `CURRENT_PIPELINE_VERSION` と
`src/nextjs/lib/pipeline.ts` を揃える。

## セットアップ / 実行

```sh
cp .env.example .env   # DATABASE_URL などを設定
uv sync                # 依存をインストール
uv run python main.py  # ワーカー起動
```

`SEGNOTE_WORKER_CONCURRENCY` で並列度を調整する。複数ホストで起動しても
`FOR UPDATE SKIP LOCKED` により互いに別のジョブを掴むので安全にスケールできる。
