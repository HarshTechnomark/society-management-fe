import { getMe } from '@/lib/auth';
import { configureFileUploader, type FileUploader } from '@/lib/fileUpload';

/**
 * Development stand-in for the module 01 file upload: sends the raw bytes to the backend's development-only
 * `POST /api/v1/dev/files`, which keeps them in memory and answers `{ fileId }`. The backend never mounts that route
 * in production, and `registerDevFileUploader` does nothing there, so the screens keep saying "not available yet".
 */
export const devFileUploader: FileUploader = {
  async upload(file, purpose, opts) {
    const me = getMe();
    const societyId = opts?.societyId ?? me?.activeSocietyId;
    if (!me || !societyId) throw new Error('Sign in to a society before uploading a file.');
    const query = new URLSearchParams({
      societyId: String(societyId),
      ownerUserId: String(me.user.id),
      name: file.name,
      purpose,
    });
    const res = await fetch(`/api/v1/dev/files?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const body = (await res.json().catch(() => null)) as { data?: { fileId?: number } } | null;
    const fileId = body?.data?.fileId;
    if (!res.ok || typeof fileId !== 'number') throw new Error('The file could not be uploaded.');
    return { fileId };
  },
};

export function registerDevFileUploader(env: string | undefined = process.env.NODE_ENV): void {
  if (env === 'production') return;
  configureFileUploader(devFileUploader);
}
