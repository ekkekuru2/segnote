"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export function UploadForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError(null);
    setDone(false);
    setProgress(0);

    try {
      // 大きなファイルを扱うため、本体はストリームで送る。進捗を出すために
      // XMLHttpRequest を使う(fetch は upload 進捗を取れないため)。
      await uploadWithProgress(`/t/${teamId}/upload`, file, title, setProgress);
      setDone(true);
      setFile(null);
      setTitle("");
      router.refresh(); // 一覧を最新化(処理待ちの録音を表示)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "アップロードに失敗しました",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新規録音</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">タイトル（任意）</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: チャイコフスキー交響曲第5番"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">音声・動画ファイル</Label>
            <Input
              id="file"
              type="file"
              accept="audio/*,video/*"
              required
              className="h-auto py-1.5"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setDone(false);
                setError(null);
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name}（{formatBytes(file.size)}）
              </p>
            )}
          </div>

          {pending && (
            <div className="flex flex-col gap-1.5">
              <Progress value={progress} />
              <span className="text-xs text-muted-foreground">
                アップロード中… {progress}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending || !file}>
              <Upload />
              {pending ? "アップロード中…" : "アップロード"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {done && (
              <span className="text-sm text-muted-foreground">
                アップロードしました（処理待ち）
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  title: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-title", encodeURIComponent(title));
    xhr.setRequestHeader("x-last-modified", String(file.lastModified));
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let message = `アップロードに失敗しました (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error) message = data.error;
        } catch {
          // ignore parse error
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("ネットワークエラー"));
    xhr.send(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
