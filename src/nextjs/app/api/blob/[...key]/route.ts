import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { openStorageFile } from "@/lib/storage";

// ストレージに保存した録音ファイルを配信する。
// 各録音の再生画面(あとで作る)や、アップロード確認に使う。
// TODO(auth): 本来はチームのメンバーのみ配信可能にする認可が必要。

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  const ext = joined.slice(joined.lastIndexOf(".")).toLowerCase();

  try {
    const { stream, size } = await openStorageFile(joined);
    const webStream = Readable.toWeb(
      stream,
    ) as NodeWebReadableStream<Uint8Array>;
    return new Response(webStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
