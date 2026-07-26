"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
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
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700">
          タイトル（任意）
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: チャイコフスキー交響曲第5番"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700">
          音声・動画ファイル
        </span>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50">
          <input
            type="file"
            accept="audio/*,video/*"
            required
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setDone(false);
              setError(null);
            }}
          />
          {file ? (
            <span className="font-medium text-zinc-800">
              {file.name}（{formatBytes(file.size)}）
            </span>
          ) : (
            <span>クリックしてファイルを選択</span>
          )}
        </label>
      </div>

      {pending && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">
            アップロード中… {progress}%
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !file}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "アップロード中…" : "アップロード"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        {done && (
          <span className="text-sm text-green-600">
            アップロードしました（処理待ち）
          </span>
        )}
      </div>
    </form>
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
