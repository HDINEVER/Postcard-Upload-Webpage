import { Client, Databases, Storage, ID } from 'appwrite';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_URL)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

// Initialize services
export const databases = new Databases(client);
export const storage = new Storage(client);

// Export configuration constants
export const config = {
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  collectionId: import.meta.env.VITE_APPWRITE_COLLECTION_ID,
  bucketId: import.meta.env.VITE_APPWRITE_BUCKET_ID,
};

// Helper function to upload submission
export async function submitEntry({
  name,
  phone,
  school,
  studentId,
  category,
  file,
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  category: string;
  file: File;
}) {
  try {
    // Upload file to storage
    const fileId = ID.unique();
    const uploadedFile = await storage.createFile(
      config.bucketId,
      fileId,
      file
    );

    // Create database entry
    const entry = await databases.createDocument(
      config.databaseId,
      config.collectionId,
      ID.unique(),
      {
        name,
        phone,
        school,
        student_id: studentId,
        category,
        file_id: uploadedFile.$id,
        file_name: file.name,
        file_size: file.size,
        submitted_at: new Date().toISOString(),
      }
    );

    return { success: true, entry, file: uploadedFile };
  } catch (error) {
    console.error('Submission error:', error);
    throw error;
  }
}

// Helper function to get file download URL
export function getFileDownloadUrl(fileId: string): string {
  return `${import.meta.env.VITE_APPWRITE_URL}/storage/buckets/${config.bucketId}/files/${fileId}/download`;
}
