// 録音のURL用id・表示まわりのヘルパー。

/** "foo.wav" -> "foo" 。拡張子を落とす。 */
export function stripExtension(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, "");
}

/**
 * URL用の recordingId を組み立てる。
 * 例: 20260727_102539_チャイコフスキー交響曲第5番
 *
 * NOTE: src/README.md では最終的な曲名は「どのReferenceがヒットしたSegmentが多いか」で
 * 決めることになっている。曲名判定はパイプライン後なので、アップロード時点では
 * ユーザー入力/ファイル名を暫定タイトルとして使う。
 */
export function buildRecordingId(date: Date, title: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const slug = title
    .replace(/[/\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return slug ? `${stamp}_${slug}` : stamp;
}
