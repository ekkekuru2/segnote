# AGENTS.md — Segnote 実装ガイド

合奏録音の価値を最大化するアプリ。コンセプトは `../README.md`、仕様は `./README.md`。
ここには **既存ドキュメントを読んだだけでは分からない実装上の勘所** をまとめる。

## 全体構成

- `nextjs/` … Web（Next.js 16 App Router）。DBのCRUD、録音のアップロードUI。Next固有の注意は `nextjs/AGENTS.md` も参照。
- `worker/` … Python の常駐ワーカー。GPUサーバ上で動かす想定で、HTTP APIは持たない。
- **連携は PostgreSQL のジョブテーブル `ProcessingJob` 経由**（Redis等は使わない）。NextJSがアップロード時に PENDING のジョブを作り、workerが拾って処理する。

## データベース / Prisma 7

- スキーマ: `nextjs/prisma/schema.prisma`。
- **Prisma 7 は driver adapter 必須**。`@prisma/adapter-pg` を使う。アプリからは必ず `nextjs/lib/db.ts` の singleton を使う（毎回 new すると接続が増える）。
- 生成クライアントは **gitignore された `nextjs/app/generated/prisma/`**。clone直後やスキーマ変更後は `pnpm exec prisma generate` が必要。
  - import 先: `@/app/generated/prisma/client`（`PrismaClient`, `Prisma`）、enum は `@/app/generated/prisma/enums`。
- **マイグレーションは shadow DB が作れない**（dev DBユーザーに CREATE DATABASE 権限が無く、`prisma migrate dev` は P3014 で失敗する）。次の手順で運用する:
  1. `pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql`
     - 既存マイグレーションからの差分は `--from-migrations prisma/migrations --to-schema prisma/schema.prisma`。
     - 旧フラグ `--to-schema-datamodel` は廃止。`--from-schema` / `--to-schema` を使う。
  2. `pnpm exec prisma migrate deploy` で適用（shadow DB 不要）。
- デモ用チームは `pnpm exec tsx prisma/seed.ts`（`/t/demo` で閲覧できる）。

## ファイルストレージ / アップロード

- 録音の実体はローカルFSに保存する枠組み。保存先は環境変数 **`SEGNOTE_STORAGE_DIR`**（**nextjs と worker で同じ場所を指すこと**）。`Recording.blobUrl` はこのディレクトリ起点のキー。
- 配信は `GET /api/blob/[...key]`。将来 S3 等に替えるなら `nextjs/lib/storage.ts` と `worker/config.py` の層だけ差し替える。
- **アップロードに Server Action を使わないこと。** Server Action はボディ 1MB 制限があり、かつ全体をメモリに載せる。録音は数百MB〜GBになるので、**ストリーミングする Route Handler `POST /t/[teamId]/upload`** を使う（本体=生バイト、メタデータ=`x-filename`等のヘッダ、ディスクへ逐次書き込み）。クライアントは進捗表示のため fetch ではなく XHR を使っている。

## ワーカー / ジョブキュー

- `worker/main.py` が複数スレッドでポーリング。ジョブ取得は **`FOR UPDATE SKIP LOCKED`**（`worker/db.py`）で1件ずつアトミックに掴む → 複数プロセス／ホストで安全に並列化できる。
- worker は生SQLでDBを触る。**識別子は camelCase なので必ずダブルクオートで囲う**（`"ProcessingJob"`, `"recordingUuid"` 等）。
- クラッシュ等で `RUNNING` のまま残ったジョブは janitor が `SEGNOTE_STALE_JOB_TIMEOUT` 経過後に PENDING へ戻す。
- 依存は `uv`（`cd worker && uv sync`、`uv run python main.py`）。`inaSpeechSegmenter` は tensorflow を伴い重いので、`segmentation.py` 内で遅延 import している。

## パイプラインのバージョニング（重要な設計方針）

- ステージ構成も各ステージのモデルも将来変わる前提。**どのバージョンで処理すべき／したかを追跡する**:
  - `Recording.targetPipelineVersion`（アップロード時）/ `processedPipelineVersion`（完了時）
  - `ProcessingJob.pipelineVersion` と `stageRuns`（JSON: ステージごとの processor / version / 結果）
- ステージIDは変わりうるので **Prisma enum ではなく文字列** で持つ。
- バージョン定数 `CURRENT_PIPELINE_VERSION` は **`nextjs/lib/pipeline.ts` と `worker/pipeline.py` の両方にあり、必ず揃える**。

## UI

- **shadcn/ui（Radix ベース）** を採用。コンポーネントは `nextjs/components/ui/` に生成され、直接編集してよい。追加は `pnpm dlx shadcn@latest add <name>`。
- 色はセマンティックトークン（`bg-card`, `text-muted-foreground` 等）を使う。生の `zinc-500` 等の直書きは避ける。テーマは `nextjs/app/globals.css` の CSS変数で一括変更できる。
- **ライトモードが既定、ダークは `.dark` クラスが付いたときだけ**（コンセプト通りダークはオプション）。
- フォントは `layout.tsx` の Geist を `--font-sans` に配線済み。

## ツール / 検証

- Lint / format は **biome**: `pnpm lint`（check）、`pnpm format`（write）。生成された shadcn コンポーネントもリポジトリの biome スタイルに合わせて整形している。
- 変更後は `pnpm exec tsc --noEmit` と `pnpm build` を通す。
- **エディタのTS言語サーバは、生成物 `@/app/generated/prisma/*` や `next/navigation` を一時的に解決できず誤検知することがある**。正はコマンドラインの `tsc`。
