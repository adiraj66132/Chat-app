import { apiRequest } from './client';

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<UploadResult>('/api/uploads', {
    method: 'POST',
    body: form,
  });
}
