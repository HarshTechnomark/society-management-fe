/**
 * Adapter for the module 01 file upload flow (create upload, send the bytes, confirm). Module 01 files are not
 * built yet, so no uploader is registered and the screens say so and let the person go on without a file.
 * When module 01 lands, call `configureFileUploader` once at start-up with the real implementation.
 */
export type FilePurpose = 'TDS_CERTIFICATE' | 'PLATFORM_ATTACHMENT' | 'IMPORT_FILE' | 'SOCIETY_LOGO';

export interface FileUploader {
  upload(file: File, purpose: FilePurpose): Promise<{ fileId: number }>;
}

let uploader: FileUploader | null = null;

export function configureFileUploader(next: FileUploader | null) {
  uploader = next;
}
export const fileUploadAvailable = () => uploader !== null;

export async function uploadFile(file: File, purpose: FilePurpose): Promise<{ fileId: number }> {
  if (!uploader) throw new Error('File upload is not available yet.');
  return uploader.upload(file, purpose);
}
