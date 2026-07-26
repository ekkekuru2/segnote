import { notFound } from "next/navigation";
import type { JobStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { UploadForm } from "./upload-form";

// アップロードした録音がすぐ処理待ちとして反映されるよう、常に最新を取得する。
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "処理待ち",
  RUNNING: "処理中",
  DONE: "完了",
  FAILED: "失敗",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  PENDING: "bg-zinc-100 text-zinc-600",
  RUNNING: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function StatusBadge({
  status,
  stage,
}: {
  status: JobStatus | null;
  stage: string | null;
}) {
  if (!status) {
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
        ジョブなし
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
      {status === "RUNNING" && stage ? `（${stage}）` : ""}
    </span>
  );
}

export default async function TeamTopPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      recordings: {
        orderBy: { uploadDate: "desc" },
        take: 50,
        include: { job: true },
      },
    },
  });

  if (!team) {
    notFound();
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-zinc-500">Segnote</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {team.name}
          </h1>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700">新規録音</h2>
          <UploadForm teamId={team.id} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700">最近の録音</h2>
          {team.recordings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400">
              まだ録音がありません。上のフォームからアップロードしてください。
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {team.recordings.map((rec) => (
                <li
                  key={rec.uuid}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <a
                      href={`/t/${team.id}/recs/${rec.id}`}
                      className="truncate text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {rec.title}
                    </a>
                    <span className="truncate text-xs text-zinc-400">
                      {rec.uploadDate.toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <StatusBadge
                    status={rec.job?.status ?? null}
                    stage={rec.job?.stage ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
