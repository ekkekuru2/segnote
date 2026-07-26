import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { CURRENT_PIPELINE_VERSION } from "@/lib/pipeline";
import { buildRecordingId, stripExtension } from "@/lib/recordings";
import { saveUploadedStream } from "@/lib/storage";

// 録音のアップロード先。ファイル本体はリクエストボディとしてストリームで受け取り、
// 逐次ストレージへ書き込む(Server Action の 1MB ボディ制限・メモリ buffering を回避)。
// メタデータ(ファイル名・タイトル・更新日時)はヘッダで受け取る。
//
// TODO(auth): ログインユーザーが当該チームへの書き込み権限を持つか検証する。

const AUDIO_VIDEO_EXT = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".opus",
  ".wma",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".m4v",
]);

function isAudioOrVideo(contentType: string, filename: string): boolean {
  if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    return true;
  }
  const dot = filename.lastIndexOf(".");
  return dot >= 0 && AUDIO_VIDEO_EXT.has(filename.slice(dot).toLowerCase());
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await ctx.params;

  const filename = decodeHeader(req.headers.get("x-filename"));
  const titleHeader = decodeHeader(req.headers.get("x-title")).trim();
  const lastModified = Number(req.headers.get("x-last-modified"));
  const contentType = req.headers.get("content-type") ?? "";

  if (!isAudioOrVideo(contentType, filename)) {
    return Response.json(
      { error: "音声ファイルまたは動画ファイルを選択してください" },
      { status: 400 },
    );
  }
  if (!req.body) {
    return Response.json({ error: "ファイルがありません" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return Response.json({ error: "チームが見つかりません" }, { status: 404 });
  }

  const fileCreateDate =
    Number.isFinite(lastModified) && lastModified > 0
      ? new Date(lastModified)
      : new Date();
  const title = titleHeader || stripExtension(filename) || "無題の録音";

  const recordingUuid = randomUUID();
  const { key: blobUrl, size } = await saveUploadedStream(
    recordingUuid,
    filename,
    req.body,
  );
  if (size === 0) {
    return Response.json({ error: "空のファイルです" }, { status: 400 });
  }

  const baseId = buildRecordingId(fileCreateDate, title);
  let recordingId = baseId;
  for (let attempt = 0; ; attempt++) {
    recordingId = attempt === 0 ? baseId : `${baseId}_${attempt + 1}`;
    try {
      await prisma.recording.create({
        data: {
          uuid: recordingUuid,
          id: recordingId,
          teamUuid: team.uuid,
          title,
          uploadDate: new Date(),
          fileCreateDate,
          blobUrl,
          targetPipelineVersion: CURRENT_PIPELINE_VERSION,
          job: {
            create: {
              status: "PENDING",
              pipelineVersion: CURRENT_PIPELINE_VERSION,
            },
          },
        },
      });
      break;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        attempt < 20
      ) {
        continue; // id 衝突。連番を上げて再試行。
      }
      throw e;
    }
  }

  return Response.json({ ok: true, recordingId });
}

/** ヘッダ値は非ASCII(日本語ファイル名等)対策で encodeURIComponent 済み。 */
function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
