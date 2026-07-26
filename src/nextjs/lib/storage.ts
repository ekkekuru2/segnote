import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

// アップロードされた音声/動画ファイルの実体を置く場所。
//
// 現時点ではローカルファイルシステムに保存する枠組み。NextJS と Python ワーカーが
// 同じディレクトリを共有できることが前提(同一ホスト or 共有ボリューム)。
// 将来 S3 等のオブジェクトストレージに差し替える場合は、この層だけ置き換えればよい。
// worker 側の config.py も同じ既定値/環境変数(SEGNOTE_STORAGE_DIR)を参照する。
//
// 実行時に解決する(トップレベルで process.cwd() を呼ぶとビルド時のファイルトレースが
// プロジェクト全体に広がって警告になるため)。
export function storageDir(): string {
  // NextJS と worker が同じ場所を指す必要があるため、保存先は環境変数で明示する。
  // (dev では .env に SEGNOTE_STORAGE_DIR=<repo>/src/storage を設定済み)
  const dir = process.env.SEGNOTE_STORAGE_DIR;
  if (!dir) {
    throw new Error(
      "SEGNOTE_STORAGE_DIR is not set. worker と共有するストレージのパス" +
        "(例: <repo>/src/storage)を指定してください。",
    );
  }
  return dir;
}

/** ストレージキー(例: "recordings/<uuid>/original.wav")を実体パスに解決する。 */
export function resolveStoragePath(key: string): string {
  const base = storageDir();
  // 先頭スラッシュや ".." による base 外への脱出を防ぐ。
  const normalized = path
    .normalize(key)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
  const full = path.resolve(base, normalized);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return full;
}

/** ファイル名を安全な形に整える(ディレクトリ区切りや制御文字を除去)。 */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[/\\]/g, "_");
  const cleaned = base
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字を意図的に除去
    .replace(/[\x00-\x1f<>:"|?*]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "upload";
}

/**
 * アップロードされたファイルのボディ(ReadableStream)をストレージへ逐次書き込む。
 * 数十分〜数時間の録音は数百MB〜GBになりうるので、全体をメモリに載せず流し込む。
 * 保存したキーとバイト数を返す。
 */
export async function saveUploadedStream(
  recordingUuid: string,
  filename: string,
  body: ReadableStream<Uint8Array>,
): Promise<{ key: string; size: number }> {
  const safe = sanitizeFilename(filename || "upload");
  const key = path.posix.join("recordings", recordingUuid, safe);
  const dest = resolveStoragePath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(
    Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
    createWriteStream(dest),
  );
  const info = await stat(dest);
  return { key, size: info.size };
}

/** ストレージ上のファイルを読み出すための ReadStream とサイズを返す(配信用)。 */
export async function openStorageFile(key: string) {
  const full = resolveStoragePath(key);
  const info = await stat(full);
  return { stream: createReadStream(full), size: info.size };
}
