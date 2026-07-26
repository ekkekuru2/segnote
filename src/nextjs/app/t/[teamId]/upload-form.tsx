"use client";

import { useActionState, useRef, useState } from "react";
import { type UploadState, uploadRecording } from "./actions";

const initialUploadState: UploadState = { ok: false };

export function UploadForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(
    uploadRecording,
    initialUploadState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [lastModified, setLastModified] = useState<number>(0);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="lastModified" value={lastModified} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700">
          タイトル（任意）
        </label>
        <input
          id="title"
          name="title"
          type="text"
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
            name="file"
            type="file"
            accept="audio/*,video/*"
            required
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileName(f?.name ?? "");
              setLastModified(f?.lastModified ?? 0);
            }}
          />
          {fileName ? (
            <span className="font-medium text-zinc-800">{fileName}</span>
          ) : (
            <span>クリックしてファイルを選択</span>
          )}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "アップロード中…" : "アップロード"}
        </button>
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {state.ok && (
          <span className="text-sm text-green-600">
            アップロードしました（処理待ち）
          </span>
        )}
      </div>
    </form>
  );
}
