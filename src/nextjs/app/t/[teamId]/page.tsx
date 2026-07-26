import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { JobStatus } from "@/app/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { UploadForm } from "./upload-form";

// アップロードした録音がすぐ処理待ちとして反映されるよう、常に最新を取得する。
export const dynamic = "force-dynamic";

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  variant: React.ComponentProps<typeof Badge>["variant"];
  className?: string;
};

// ジョブ状態 -> バッジの見た目。ここを変えれば表示を調整できる。
const STATUS_META: Record<JobStatus, StatusMeta> = {
  PENDING: { label: "処理待ち", icon: Clock, variant: "secondary" },
  RUNNING: { label: "処理中", icon: Loader2, variant: "default" },
  DONE: {
    label: "完了",
    icon: CheckCircle2,
    variant: "outline",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  FAILED: { label: "失敗", icon: AlertTriangle, variant: "destructive" },
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
      <Badge variant="outline" className="text-muted-foreground">
        ジョブなし
      </Badge>
    );
  }
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className={meta.className}>
      <Icon className={status === "RUNNING" ? "animate-spin" : undefined} />
      {meta.label}
      {status === "RUNNING" && stage ? `（${stage}）` : ""}
    </Badge>
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Segnote</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {team.name}
        </h1>
      </header>

      <UploadForm teamId={team.id} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          最近の録音
        </h2>
        {team.recordings.length === 0 ? (
          <Card className="items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground ring-dashed">
            まだ録音がありません。上のフォームからアップロードしてください。
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
              {team.recordings.map((rec) => (
                <li
                  key={rec.uuid}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`/t/${team.id}/recs/${rec.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {rec.title}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
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
          </Card>
        )}
      </section>
    </main>
  );
}
