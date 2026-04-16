import { Client, Databases, Storage, ID } from 'appwrite';

const configuredEndpoint = (
  import.meta.env.VITE_APPWRITE_URL || import.meta.env.VITE_APPWRITE_ENDPOINT || ''
).trim();

const appwriteConfig = {
  endpoint: configuredEndpoint,
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
  ['VITE_APPWRITE_URL 或 VITE_APPWRITE_ENDPOINT', appwriteConfig.endpoint],
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

const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '当前页面来源';

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
  }

  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return new Error(
      `无法连接到 Appwrite 上传接口。当前页面来源是 ${currentOrigin}。请优先检查 1) Appwrite Platforms/CORS 是否已放行这个来源，2) Cloudflare Access、WAF 或挑战页是否仍在拦截 /v1/storage 或 /v1/databases 请求，3) 修改配置后是否已强制刷新浏览器并重启开发服务器。浏览器直连 Appwrite 不需要 API Key。`
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
