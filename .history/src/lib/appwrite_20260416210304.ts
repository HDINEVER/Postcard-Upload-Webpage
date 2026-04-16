import { Client, Databases, Storage, ID } from 'appwrite';

const configuredEndpoint = (
  import.meta.env.VITE_APPWRITE_URL || import.meta.env.VITE_APPWRITE_ENDPOINT || ''
).trim();

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalDevHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In local development, route SDK traffic through Vite proxy (/v1) to avoid browser CORS variance.
const effectiveEndpoint = isLocalDevHost && browserOrigin ? `${browserOrigin}/v1` : configuredEndpoint;

const appwriteConfig = {
  endpoint: effectiveEndpoint,
  projectId: (import.meta.env.VITE_APPWRITE_PROJECT_ID || '').trim(),
  databaseId: (import.meta.env.VITE_APPWRITE_DATABASE_ID || '69de43e100124b512cbb').trim(),
  collectionId: (import.meta.env.VITE_APPWRITE_COLLECTION_ID || '').trim(),
  bucketId: (import.meta.env.VITE_APPWRITE_BUCKET_ID || '').trim(),
  bucketIds: {
    video: (import.meta.env.VITE_APPWRITE_BUCKET_VIDEO || '69df4311003df133de23').trim(),
    presentation: (import.meta.env.VITE_APPWRITE_BUCKET_PPT || '69df430100088d621422').trim(),
    postcard: (import.meta.env.VITE_APPWRITE_BUCKET_POSTCARD || '69df42a60004a562ba07').trim(),
  },
};

const missingEnvKeys = [
  ['VITE_APPWRITE_URL 或 VITE_APPWRITE_ENDPOINT', configuredEndpoint],
  ['VITE_APPWRITE_PROJECT_ID', appwriteConfig.projectId],
  ['VITE_APPWRITE_DATABASE_ID', appwriteConfig.databaseId],
  ['VITE_APPWRITE_COLLECTION_ID', appwriteConfig.collectionId],
  ['VITE_APPWRITE_BUCKET_VIDEO', appwriteConfig.bucketIds.video],
  ['VITE_APPWRITE_BUCKET_PPT', appwriteConfig.bucketIds.presentation],
  ['VITE_APPWRITE_BUCKET_POSTCARD', appwriteConfig.bucketIds.postcard],
]
  .filter(([, value]) => !value)
  .map(([key]) => key as string);

const isAppwriteConfigured = missingEnvKeys.length === 0;

// Avoid hard crash on app boot when env is missing.
const client = new Client();
if (isAppwriteConfigured) {
  client.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId);

  if (isLocalDevHost) {
    console.info('[Appwrite] Local dev proxy enabled:', {
      configuredEndpoint,
      effectiveEndpoint: appwriteConfig.endpoint,
      origin: browserOrigin,
    });
  }
}

// Initialize services
export const databases = isAppwriteConfigured ? new Databases(client) : null;
export const storage = isAppwriteConfigured ? new Storage(client) : null;

// Export configuration constants
export const config = {
  databaseId: appwriteConfig.databaseId,
  collectionId: appwriteConfig.collectionId,
  bucketId: appwriteConfig.bucketId,
  bucketIds: appwriteConfig.bucketIds,
};

const categoryToBucketId: Record<string, string> = {
  video: appwriteConfig.bucketIds.video,
  presentation: appwriteConfig.bucketIds.presentation,
  postcard: appwriteConfig.bucketIds.postcard,
};

// 500 KB per chunk — safely under the ~60 s Cloudflare proxy timeout at current upload bandwidth.
const UPLOAD_CHUNK_SIZE = 500 * 1024;

/**
 * Upload a file to an Appwrite storage bucket using small chunks.
 * Falls back to a single-request upload for files at or below UPLOAD_CHUNK_SIZE.
 * Uses the Appwrite REST API directly (Content-Range + X-Appwrite-ID) so we control chunk size
 * independently of the SDK's hardcoded 5 MB threshold.
 */
async function uploadFileChunked(
  bucketId: string,
  fileId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Record<string, unknown>> {
  const endpoint = appwriteConfig.endpoint;
  const projectId = appwriteConfig.projectId;
  const totalSize = file.size;
  const url = `${endpoint}/storage/buckets/${bucketId}/files`;

  if (totalSize === 0) {
    throw new Error('文件大小为 0，请重新选择文件');
  }

  // Small file — single request, no Content-Range needed
  if (totalSize <= UPLOAD_CHUNK_SIZE) {
    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', file);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Appwrite-Project': projectId },
      body: form,
    });
    if (!res.ok) {
      throw await res.json().catch(() => ({ message: res.statusText, code: res.status }));
    }
    onProgress?.(100);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // Multi-chunk upload
  let fileObj: Record<string, unknown> | null = null;
  for (let start = 0; start < totalSize; start += UPLOAD_CHUNK_SIZE) {
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', new File([chunk], file.name, { type: file.type || 'application/octet-stream' }));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': projectId,
        'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
        'X-Appwrite-ID': fileId,
      },
      body: form,
    });

    if (res.status !== 200 && res.status !== 201) {
      throw await res.json().catch(() => ({ message: res.statusText, code: res.status }));
    }

    onProgress?.(Math.round((end / totalSize) * 100));
    fileObj = await res.json().catch(() => null) as Record<string, unknown> | null;
  }

  if (!fileObj) {
    throw new Error('上传完成但服务器未返回文件信息');
  }
  return fileObj;
}

function assertAppwriteConfigured() {
  if (!isAppwriteConfigured || !databases || !storage) {
    throw new Error(
      `Appwrite 未配置完整，请在 .env 中补齐以下变量: ${missingEnvKeys.join(', ')}`
    );
  }
}

function normalizeSubmissionError(error: unknown): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const appwriteError = error as { message: string; code?: number; type?: string };

    if (appwriteError.type === 'document_invalid_structure') {
      if (appwriteError.message.includes('schoolName')) {
        return new Error('提交失败：所选学校与 Appwrite 集合允许值不一致，请重新选择学校后再试。');
      }

      return new Error(`提交失败：${appwriteError.message}`);
    }

    if (appwriteError.code === 404 && appwriteError.type === 'general_route_not_found') {
      return new Error('提交失败：Appwrite 文档接口未找到，请检查 Database ID、Collection ID 以及当前接口路径是否与服务端版本一致。');
    }

    if (appwriteError.code === 401 || appwriteError.code === 403) {
      return new Error(`提交失败：${appwriteError.message}`);
    }

    if (appwriteError.code === 499 || appwriteError.message.includes('Client Closed Request')) {
      return new Error(
        '提交失败：上传请求在浏览器或本地开发代理层被中断。请确认当前页面打开的是 http://localhost:3000，并在重启 dev server 后刷新页面再试。'
      );
    }
  }

  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return new Error(
      '无法连接到 Appwrite 接口。请先检查 1) Appwrite 域名是否可直接访问 /v1/health，2) 是否被 Cloudflare Access、WAF 或登录保护拦截，3) Appwrite Platforms/CORS 是否已放行当前域名。浏览器直连 Appwrite 不需要 API Key。'
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('提交失败，请检查 Appwrite 配置与网络连通性');
}

// Helper function to upload submission
export async function submitEntry({
  name,
  phone,
  school,
  studentId,
  category,
  file,
  onProgress,
  onStageChange,
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  category: string;
  file: File;
  onProgress?: (progress: number) => void;
  onStageChange?: (stage: 'uploading' | 'saving') => void;
}) {
  try {
    assertAppwriteConfigured();
    const selectedBucketId = categoryToBucketId[category];
    if (!selectedBucketId) {
      throw new Error('参赛类别无效，请重新选择');
    }

    console.info('[Appwrite] Upload start:', {
      category,
      selectedBucketId,
      endpoint: appwriteConfig.endpoint,
      origin: browserOrigin || 'unknown',
      fileName: file.name,
      fileType: file.type || 'unknown',
      fileSize: file.size,
    });

    // Upload file to storage
    const fileId = ID.unique();
    onStageChange?.('uploading');
    const uploadedFile = await storage!.createFile(
      selectedBucketId,
      fileId,
      file,
      undefined,
      (progress) => {
        onProgress?.(progress.progress);
      }
    );

    onStageChange?.('saving');
    onProgress?.(95);

    // Create database entry
    const entry = await databases!.createDocument(
      config.databaseId,
      config.collectionId,
      ID.unique(),
      {
        name,
        tel: phone,
        schoolName: school,
        schoolNum: studentId,
      }
    );

    return { success: true, entry, file: uploadedFile, bucketId: selectedBucketId, school };
  } catch (error) {
    const normalizedError = normalizeSubmissionError(error);
    console.error('Submission error:', normalizedError);
    throw normalizedError;
  }
}

// Helper function to get file download URL
export function getFileDownloadUrl(fileId: string, bucketId: string): string {
  if (!isAppwriteConfigured) {
    throw new Error(
      `Appwrite 未配置完整，请在 .env 中补齐以下变量: ${missingEnvKeys.join(', ')}`
    );
  }
  return `${configuredEndpoint}/storage/buckets/${bucketId}/files/${fileId}/download`;
}
