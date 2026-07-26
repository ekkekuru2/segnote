"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { CURRENT_PIPELINE_VERSION } from "@/lib/pipeline";
import { buildRecordingId, stripExtension } from "@/lib/recordings";
import { saveUploadedFile } from "@/lib/storage";

export type UploadState = {
  ok: boolean;
  error?: string;
  recordingId?: string;
};

/**
 * 新規録音をアップロードし、Recording と PENDING の ProcessingJob を作成する。
 * ファイル実体はローカルストレージに保存し、以降は Python ワーカーがジョブを拾って処理する。
 */
export async function uploadRecording(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const teamId = String(formData.get("teamId") ?? "");
  const file = formData.get("file");
  const titleInput = String(formData.get("title") ?? "").trim();
  const lastModified = Number(formData.get("lastModified"));

  // TODO(auth): 認証・認可は未実装。本来はここでセッションを検証し、
  // ログインユーザーが当該チームに対する書き込み権限(UserTeamRole)を持つか確認する。

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ファイルを選択してください" };
  }
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
    return {
      ok: false,
      error: "音声ファイルまたは動画ファイルを選択してください",
    };
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return { ok: false, error: "チームが見つかりません" };
  }

  // ファイルのメタデータ上の作成日時(ブラウザからは lastModified が最も近い)。
  // 動画コンテナの正確な撮影日時などはパイプライン(ffprobe等)で補正する余地がある。
  const fileCreateDate =
    Number.isFinite(lastModified) && lastModified > 0
      ? new Date(lastModified)
      : new Date();
  const title = titleInput || stripExtension(file.name) || "無題の録音";

  const recordingUuid = randomUUID();
  // 実体を保存。id 生成に失敗しても uuid でキーされるので孤児ファイルにはなるが実害はない。
  const blobUrl = await saveUploadedFile(recordingUuid, file);

  const baseId = buildRecordingId(fileCreateDate, title);

  // id は [id, teamUuid] で一意。衝突したら連番を付けて再試行する。
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
          // パイプライン処理待ちのジョブを同時に作成する。
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

  revalidatePath(`/t/${teamId}`);
  return { ok: true, recordingId };
}
