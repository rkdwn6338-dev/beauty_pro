export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const BUCKET = "source-documents";
export const fileTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export function validateFile(file: {
  size: number;
  type: string;
  name: string;
}) {
  if (!(file.type in fileTypes))
    return "PDF, JPEG, PNG, WebP 파일만 업로드할 수 있습니다.";
  if (!file.size) return "비어 있는 파일은 업로드할 수 없습니다.";
  if (file.size > MAX_FILE_BYTES)
    return "파일은 하나당 20MiB까지 업로드할 수 있습니다.";
  if (file.name.length > 240) return "파일명은 240자 이내로 변경해 주세요.";
  return null;
}
export function fileSignatureMatches(bytes: Uint8Array, type: string) {
  if (type === "application/pdf")
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
export function storagePath(
  projectId: string,
  uploadId: string,
  type: keyof typeof fileTypes,
) {
  return `${projectId}/${uploadId}.${fileTypes[type]}`;
}
export function belongsToProject(path: string, projectId: string) {
  return (
    path.startsWith(`${projectId}/`) &&
    path.split("/").length === 2 &&
    !path.includes("..")
  );
}
export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MiB`
    : `${Math.ceil(bytes / 1024)} KiB`;
}
