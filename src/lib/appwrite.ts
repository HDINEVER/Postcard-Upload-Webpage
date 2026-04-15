import { Client, Databases, Storage, ID } from 'appwrite';

const appwriteConfig = {
  endpoint: (import.meta.env.VITE_APPWRITE_URL || '').trim(),
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
  ['VITE_APPWRITE_URL', appwriteConfig.endpoint],
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

function assertAppwriteConfigured() {
  if (!isAppwriteConfigured || !databases || !storage) {
    throw new Error(
      `Appwrite 未配置完整，请在 .env 中补齐以下变量: ${missingEnvKeys.join(', ')}`
    );
  }
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
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  category: string;
  file: File;
  onProgress?: (progress: number) => void;
}) {
  try {
    assertAppwriteConfigured();
    const selectedBucketId = categoryToBucketId[category];
    if (!selectedBucketId) {
      throw new Error('参赛类别无效，请重新选择');
    }

    // Upload file to storage
    const fileId = ID.unique();
    const uploadedFile = await storage!.createFile(
      selectedBucketId,
      fileId,
      file,
      undefined,
      (progress) => {
        onProgress?.(progress.progress);
      }
    );

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
    console.error('Submission error:', error);
    throw error;
  }
}

// Helper function to get file download URL
export function getFileDownloadUrl(fileId: string, bucketId: string): string {
  if (!isAppwriteConfigured) {
    throw new Error(
      `Appwrite 未配置完整，请在 .env 中补齐以下变量: ${missingEnvKeys.join(', ')}`
    );
  }
  return `${import.meta.env.VITE_APPWRITE_URL}/storage/buckets/${bucketId}/files/${fileId}/download`;
}
