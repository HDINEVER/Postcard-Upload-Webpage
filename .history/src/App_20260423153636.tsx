import { Client, Databases, Storage, ID } from 'appwrite';

const configuredEndpoint = (
  import.meta.env.VITE_APPWRITE_URL ||
  import.meta.env.VITE_APPWRITE_ENDPOINT ||
  'https://appwrite1.hdinever.top/v1'
).trim();

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isLocalDevHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In local development, route SDK traffic through Vite proxy (/v1) to avoid browser CORS variance.
const effectiveEndpoint = isLocalDevHost && browserOrigin ? `${browserOrigin}/v1` : configuredEndpoint;

const appwriteConfig = {
  endpoint: effectiveEndpoint,
  projectId: (import.meta.env.VITE_APPWRITE_PROJECT_ID || '69dc5b0700295f5740d0').trim(),
  databaseId: (import.meta.env.VITE_APPWRITE_DATABASE_ID || '69de43e100124b512cbb').trim(),
  collectionId: (import.meta.env.VITE_APPWRITE_COLLECTION_ID || 'project').trim(),
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
const CHUNK_REQUEST_TIMEOUT_MS = 90_000;
const MAX_CHUNK_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 1_500;

// Base headers that mirror the Appwrite Web SDK (v24.1.1) — required for
// Appwrite 1.9.x to parse responses correctly. Missing X-Appwrite-Response-Format
// causes the server to fall back to an older wire format that breaks error handling.
const APPWRITE_SDK_HEADERS: Record<string, string> = {
  'x-sdk-name': 'Web',
  'x-sdk-platform': 'client',
  'x-sdk-language': 'web',
  'x-sdk-version': '24.1.1',
  'X-Appwrite-Response-Format': '1.9.0',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChunkWithRetry(
  url: string,
  headers: Record<string, string>,
  form: FormData,
  start: number,
  end: number,
  totalSize: number,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHUNK_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 200 || response.status === 201) {
        return response;
      }

      const body = await response.text().catch(() => '');
      const retriable = response.status === 499 || response.status === 502 || response.status === 503 || response.status === 504;
      if (!retriable || attempt === MAX_CHUNK_RETRIES) {
        throw {
          message: body || response.statusText,
          code: response.status,
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === MAX_CHUNK_RETRIES) {
        break;
      }
    }

    const delayMs = BASE_RETRY_DELAY_MS * attempt;
    console.warn('[Appwrite] Chunk upload retry', {
      attempt,
      maxRetries: MAX_CHUNK_RETRIES,
      range: `${start}-${end - 1}/${totalSize}`,
      delayMs,
    });
    await sleep(delayMs);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`分块上传失败：${start}-${end - 1}/${totalSize}`);
}

/**
 * Upload a file to an Appwrite storage bucket using small chunks.
 * Falls back to a single-request upload for files at or below UPLOAD_CHUNK_SIZE.
 * Uses the Appwrite REST API directly (Content-Range + X-Appwrite-ID) so we control chunk size
 * independently of the SDK's hardcoded 5 MB threshold.
 * @param displayFileName Optional: custom filename to use in storage (defaults to original file.name)
 */
async function uploadFileChunked(
  bucketId: string,
  fileId: string,
  file: File,
  onProgress?: (pct: number) => void,
  displayFileName?: string,
): Promise<Record<string, unknown>> {
  const endpoint = appwriteConfig.endpoint;
  const projectId = appwriteConfig.projectId;
  const totalSize = file.size;
  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
  const fileName = displayFileName || file.name;

  if (totalSize === 0) {
    throw new Error('文件大小为 0，请重新选择文件');
  }

  // Shared base headers — always sent, matches Appwrite Web SDK v24.1.1
  const baseHeaders: Record<string, string> = {
    ...APPWRITE_SDK_HEADERS,
    'X-Appwrite-Project': projectId,
  };

  // Small file — single request, no Content-Range needed
  if (totalSize <= UPLOAD_CHUNK_SIZE) {
    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', new File([file], fileName, { type: file.type || 'application/octet-stream' }));
    const res = await fetch(url, {
      method: 'POST',
      headers: baseHeaders,
      body: form,
    });
    if (!res.ok) {
      throw await res.json().catch(() => ({ message: res.statusText, code: res.status }));
    }
    onProgress?.(100);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // Multi-chunk upload.
  // Following the SDK pattern exactly:
  //   - First chunk: send fileId in the form body, no x-appwrite-id header
  //   - After first response: extract $id and include x-appwrite-id for every subsequent chunk
  let fileObj: Record<string, unknown> | null = null;
  let uploadedFileId: string | null = null;

  for (let start = 0; start < totalSize; start += UPLOAD_CHUNK_SIZE) {
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', new File([chunk], fileName, { type: file.type || 'application/octet-stream' }));

    // content-range (lowercase) matches the SDK's exact header name.
    // x-appwrite-id is only added for chunks after the first, using the $id
    // returned by the server — this is the authoritative session identifier.
    const headers: Record<string, string> = {
      ...baseHeaders,
      'content-range': `bytes ${start}-${end - 1}/${totalSize}`,
    };
    if (uploadedFileId) {
      headers['x-appwrite-id'] = uploadedFileId;
    }

    const res = await fetchChunkWithRetry(url, headers, form, start, end, totalSize);
    onProgress?.(Math.round((end / totalSize) * 100));

    const chunkData = await res.json().catch(() => null) as Record<string, unknown> | null;
    // After the first successful chunk the server returns the canonical $id;
    // capture it immediately so every subsequent chunk carries x-appwrite-id.
    if (chunkData && typeof chunkData['$id'] === 'string') {
      uploadedFileId = chunkData['$id'] as string;
    }
    fileObj = chunkData;
  }

  if (!fileObj) {
    throw new Error('上传完成但服务器未返回文件信息');
  }
  return fileObj;
}

function assertAppwriteConfigured() {
  if (!isAppwriteConfigured || !databases || !storage) {
    throw new Error(
      `Appwrite 未配置完整，请在 .env 中补齐以下变量：${missingEnvKeys.join(', ')}`
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
        '上传超时：文件分块上传时服务器关闭了连接。请尝试上传较小的文件（建议不超过 50 MB），或联系管理员检查 Cloudflare 代理超时与上传带宽配置。'
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

function sanitizeFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Upload a file to the appropriate bucket immediately when selected (pre-upload pattern).
 * Call this as soon as the user picks a file so the upload runs while they fill the form.
 * Returns { fileId, bucketId } on success for later reference.
 */
export async function startFileUpload(
  category: string,
  file: File,
  onProgress?: (pct: number) => void,
  name?: string,
  studentId?: string,
): Promise<{ fileId: string; bucketId: string; displayFileName: string }> {
  try {
    assertAppwriteConfigured();
    const selectedBucketId = categoryToBucketId[category];
    if (!selectedBucketId) {
      throw new Error('参赛类别无效，请重新选择');
    }
    if (file.size === 0) {
      throw new Error('文件大小为 0，请重新选择文件');
    }
    const fileId = ID.unique();
    const fileExtension = file.name.split('.').pop() || 'bin';
    let displayFileName: string;
    if (name && studentId) {
      const safeStudentId = sanitizeFileNamePart(studentId) || 'unknown';
      const safeName = sanitizeFileNamePart(name) || 'anonymous';
      displayFileName = `${safeStudentId}_${safeName}_${category}.${fileExtension}`;
    } else {
      displayFileName = file.name;
    }
    await uploadFileChunked(selectedBucketId, fileId, file, onProgress, displayFileName);
    console.info('[Appwrite] Pre-upload complete:', { fileId, displayFileName });
    return { fileId, bucketId: selectedBucketId, displayFileName };
  } catch (error) {
    throw normalizeSubmissionError(error);
  }
}

/**
 * Called at form-submit time (after pre-upload) when we finally have name + studentId.
 * 1. Renames the already-uploaded file to `{studentId}_{name}_{category}.{ext}`.
 * 2. Creates a DB document using the same ID as the storage file — so the DB row's
 *    `$id` always matches the bucket file's `$id`, enabling one-click correlation on export.
 */
export async function finalizeFileSubmission({
  name,
  phone,
  school,
  studentId,
  teacher,
  teacherId,
  category,
  fileId,
  bucketId,
  originalFileName,
  onProgress,
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  teacher?: string;
  teacherId?: string;
  category: string;
  fileId: string;
  bucketId: string;
  originalFileName: string;
  onProgress?: (pct: number) => void;
}) {
  try {
    assertAppwriteConfigured();

    const fileExtension = originalFileName.split('.').pop() || 'bin';
    const safeStudentId = sanitizeFileNamePart(studentId) || 'unknown';
    const safeName = sanitizeFileNamePart(name) || 'anonymous';
    const displayFileName = `${safeStudentId}_${safeName}_${category}.${fileExtension}`;

    onProgress?.(50);

    // Create DB document with the same ID as the file so they are permanently linked.
    // (Rename via storage.updateFile is skipped: guest users only have create permission,
    //  not update — the file is already named correctly at upload time via startFileUpload.)
    const entry = await databases!.createDocument(
      config.databaseId,
      config.collectionId,
      fileId, // use fileId as document ID for 1:1 linkage
      {
        name,
        tel: phone,
        schoolName: school,
        schoolNum: studentId,
        teacher: teacher || '',
        teacherId: teacherId || '',
        videoUrl: '', // required field on the collection; empty string for file submissions
      },
    );

    console.info('[Appwrite] DB record created:', { entryId: entry.$id, fileId, displayFileName });
    onProgress?.(100);
    return { success: true, entry };
  } catch (error) {
    throw normalizeSubmissionError(error);
  }
}

// Helper function to upload submission
export async function submitEntry({
  name,
  phone,
  school,
  studentId,
  teacher,
  teacherId,
  category,
  file,
  videoUrl,
  onProgress,
  onStageChange,
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  teacher?: string;
  teacherId?: string;
  category: string;
  file: File | null;
  videoUrl?: string;
  onProgress?: (progress: number) => void;
  onStageChange?: (stage: 'uploading' | 'saving') => void;
}) {
  try {
    assertAppwriteConfigured();
    const entryId = ID.unique();

    // For video category, skip file upload and go straight to saving link
    if (category === 'video') {
      onStageChange?.('saving');
      onProgress?.(50);

      if (!videoUrl || videoUrl.trim() === '') {
        throw new Error('视频网盘链接不能为空');
      }

      const normalizedVideoUrl = videoUrl.trim();

      console.info('[Appwrite] Saving video link:', {
        rawVideoUrl: videoUrl,
        normalizedVideoUrl,
      });

      // Create database entry with video link
      const entry = await databases!.createDocument(
        config.databaseId,
        config.collectionId,
        entryId,
        {
          name,
          tel: phone,
          schoolName: school,
          schoolNum: studentId,
          teacher: teacher || '',
          teacherId: teacherId || '',
          videoUrl: normalizedVideoUrl,
        }
      );

      console.info('[Appwrite] Video entry created:', {
        entryId: entry.$id,
      });

      onProgress?.(100);
      return { success: true, entry, file: null, bucketId: null, school };
    }

    // For file-based categories (postcard, presentation)
    if (!file) {
      throw new Error('文件不能为空');
    }

    const selectedBucketId = categoryToBucketId[category];
    if (!selectedBucketId) {
      throw new Error('参赛类别无效，请重新选择');
    }

    // Generate standardized filename for uploader traceability.
    const fileExtension = file.name.split('.').pop() || 'bin';
    const safeStudentId = sanitizeFileNamePart(studentId) || 'unknown';
    const safeName = sanitizeFileNamePart(name) || 'anonymous';
    const displayFileName = `${safeStudentId}_${safeName}_${category}.${fileExtension}`;

    console.info('[Appwrite] Upload start:', {
      category,
      selectedBucketId,
      endpoint: appwriteConfig.endpoint,
      origin: browserOrigin || 'unknown',
      originalFileName: file.name,
      displayFileName,
      fileType: file.type || 'unknown',
      fileSize: file.size,
    });

    // Use the same ID for both storage file and database row so they can be linked reliably.
    const fileId = entryId;
    onStageChange?.('uploading');
    const uploadedFile = await uploadFileChunked(
      selectedBucketId,
      fileId,
      file,
      (pct) => onProgress?.(pct),
      displayFileName,
    );

    onStageChange?.('saving');
    onProgress?.(95);

    console.info('[Appwrite] File upload complete:', {
      uploadedFile,
      fileId: (uploadedFile as any)?.$id,
      displayFileName,
    });

    // For postcard/presentation, finish after successful bucket upload.
    return { success: true, entry: null, file: uploadedFile, bucketId: selectedBucketId, school };
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
      `Appwrite 未配置完整，请在 .env 中补齐以下变量：${missingEnvKeys.join(', ')}`
    );
  }
  return `${configuredEndpoint}/storage/buckets/${bucketId}/files/${fileId}/download`;
}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">联系电话</label>
                  <input 
                    required 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    inputMode="numeric"
                    pattern="[0-9]{11}"
                    maxLength={11}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入11位手机号码" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">所在学校</label>
                  <div className="relative">
                    <select
                      required
                      value={isCustomSchool ? '__other__' : formData.school}
                      onChange={(e) => {
                        if (e.target.value === '__other__') {
                          setIsCustomSchool(true);
                          setFormData(prev => ({ ...prev, school: '' }));
                        } else {
                          setIsCustomSchool(false);
                          setFormData(prev => ({ ...prev, school: e.target.value }));
                        }
                      }}
                      className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white text-zinc-900"
                    >
                      <option value="" disabled>请选择所在学校</option>
                      {SCHOOL_PRESETS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__other__">其他学校（手动输入）</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </div>
                  {isCustomSchool && (
                    <input
                      required
                      type="text"
                      name="school"
                      value={formData.school}
                      onChange={handleInputChange}
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white text-zinc-900"
                      placeholder="请输入学校全称"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">学号</label>
                  <input 
                    required 
                    type="text" 
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入学号" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">指导教师姓名 <span className="font-normal text-zinc-400 text-xs">(可不填)</span></label>
                  <input 
                    type="text" 
                    name="teacher"
                    value={formData.teacher || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入指导教师姓名" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">指导教师工号 <span className="font-normal text-zinc-400 text-xs">(可不填)</span></label>
                  <input 
                    type="text" 
                    name="teacherId"
                    value={formData.teacherId || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入指导教师工号" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">参赛类别</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="postcard" 
                      checked={formData.category === 'postcard'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">文创设计</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">图片格式 (JPG/PNG)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="presentation" 
                      checked={formData.category === 'presentation'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">演示文稿演讲</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">文档格式 (PPT/PDF)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="video" 
                      checked={formData.category === 'video'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">项目视频</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">粘贴网盘分享链接</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">作品上传</label>

                {/* Hint: fill name+studentId first so the file gets the correct name in the bucket */}
                {formData.category !== 'video' && (!formData.name.trim() || !formData.phone.trim()) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formData.category === 'postcard'
                      ? <span>请先填写<strong>姓名</strong>和<strong>手机号</strong>，文件以「学校_参赛者姓名_作品名称_序号」命名上传</span>
                      : <span>请先填写<strong>姓名</strong>和<strong>手机号</strong>，文件以「学校_参赛者姓名_作品名称」命名上传</span>
                    }
                  </div>
                )}
                {formData.category === 'video' ? (
                  // Video category: cloud drive link
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                      <div className="px-4 py-3 bg-blue-100/60 border-b border-blue-200">
                        <p className="text-sm font-bold text-blue-800">视频上传步骤</p>
                      </div>
                      <ol className="px-4 py-3 space-y-2.5 text-sm text-blue-800">
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                          <span>将视频上传至<strong>百度云盘</strong>或<strong>夸克网盘</strong></span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                          <span>将文件名命名为：<strong className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">学校_参赛者姓名_概括主题</strong></span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                          <span>点击<strong>分享文件</strong>，有效时间设置为<strong>永久</strong>，<span className="text-red-600 font-semibold">不要设置提取密码</span></span>
                        </li>
                        <li className="flex gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                          <span>将生成的<strong>分享链接</strong>粘贴到下方输入框</span>
                        </li>
                      </ol>
                    </div>
                    <input
                      type="text"
                      name="videoUrl"
                      value={formData.videoUrl || ''}
                      onChange={handleInputChange}
                      placeholder="请粘贴网盘分享链接（无提取密码）"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white"
                    />
                    {formData.videoUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>链接已粘贴</span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  // Postcard & Presentation: file upload
                  <div
                    onClick={openFilePicker}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    className={`mt-2 flex w-full justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all relative group bg-zinc-50/50 text-left cursor-pointer ${
                      isDragging
                        ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100'
                        : 'border-zinc-200 hover:border-orange-400 hover:bg-orange-50/30'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 mb-4 mx-auto bg-white rounded-full shadow-sm flex items-center justify-center border border-zinc-100 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-zinc-400 group-hover:text-orange-500 transition-colors" aria-hidden="true" />
                      </div>
                      <div className="flex text-sm leading-6 text-zinc-600 justify-center">
                        <span className="rounded-md font-bold text-orange-600">
                          点击选择文件
                        </span>
                        <p className="pl-1">或拖拽至此区域</p>
                      </div>
                      <p className="text-xs leading-5 text-zinc-400 mt-2">{currentFileRule.label}</p>
                      <input
                        ref={fileInputRef}
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        required
                        accept={currentFileRule.accept}
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                      {file && (
                        <AnimatePresence mode="wait">
                          {preUpload.status === 'uploading' && (
                            <motion.div
                              key="uploading"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="mt-6 w-full max-w-xs mx-auto"
                            >
                              <div className="flex items-center justify-between text-xs text-zinc-600 mb-1.5 font-medium">
                                <span className="truncate mr-2">{file.name}</span>
                                <span className="flex-shrink-0">{preUpload.progress}%</span>
                              </div>
                              <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                                <motion.div
                                  className="h-2 bg-orange-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${preUpload.progress}%` }}
                                  transition={{ ease: 'linear', duration: 0.3 }}
                                />
                              </div>
                              <p className="text-xs text-zinc-400 mt-1.5 text-center">上传中，请勿关闭页面...</p>
                            </motion.div>
                          )}
                          {preUpload.status === 'done' && (
                            <motion.div
                              key="done"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium shadow-sm"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFile(null);
                                  setFilesByCategory((prev) => ({ ...prev, [formData.category]: null }));
                                  setPreUploadByCategory((prev) => ({ ...prev, [formData.category]: { ...EMPTY_PRE_UPLOAD } }));
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                  }
                                }}
                                className="ml-2 text-green-400 hover:text-green-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </motion.div>
                          )}
                          {preUpload.status === 'error' && (
                            <motion.div
                              key="error"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-6 space-y-2"
                            >
                              <div className="flex items-center gap-2 text-red-600 text-xs justify-center">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-center">{preUpload.error}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  assignFile(file);
                                }}
                                className="block mx-auto text-xs text-orange-600 font-medium hover:text-orange-700 underline"
                              >
                                点击重试
                              </button>
                            </motion.div>
                          )}
                          {(preUpload.status === 'idle') && (
                            <motion.div
                              key="idle"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-white border border-orange-200 text-orange-700 text-sm font-medium shadow-sm"
                            >
                              <span className="truncate max-w-[200px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFile(null);
                                  setFilesByCategory((prev) => ({ ...prev, [formData.category]: null }));
                                  setPreUploadByCategory((prev) => ({ ...prev, [formData.category]: { ...EMPTY_PRE_UPLOAD } }));
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                  }
                                }}
                                className="ml-2 text-orange-400 hover:text-orange-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end gap-4">
                <button 
                  type="button" 
                  onClick={onClose} 
                  disabled={loading}
                  className="px-6 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={loading || (formData.category !== 'video' && preUpload.status === 'uploading')}
                  className="px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {loading
                    ? '提交中...'
                    : formData.category !== 'video' && preUpload.status === 'uploading'
                    ? '文件上传中...'
                    : '确认提交'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="py-32 flex flex-col items-center justify-center space-y-6">
              <div className="w-full max-w-md space-y-4">
                <div className="flex items-center justify-between text-sm font-semibold text-zinc-600">
                  <span>{progressTitle}</span>
                  <span>{progressLabel}</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-orange-100">
                  <motion.div
                    className="h-full rounded-full bg-orange-500"
                    animate={{ width: `${Math.max(uploadProgress, 6)}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                </div>
                <p className="text-center text-lg font-bold text-zinc-700">
                  {progressDescription}
                </p>
                <p className="text-center text-sm text-zinc-500">
                  {progressHint}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              >
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
              </motion.div>
              <div className="space-y-3">
                <h4 className="text-3xl font-black text-zinc-900">提交成功！</h4>
                <p className="text-zinc-500 max-w-sm mx-auto">您的作品已成功上传至大赛组委会，请保持通讯畅通，祝您取得好成绩。</p>
              </div>
              <button onClick={onClose} className="mt-8 px-10 py-4 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all hover:-translate-y-0.5 shadow-xl shadow-zinc-900/20">
                返回首页
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 overflow-hidden relative font-sans selection:bg-orange-200 flex flex-col">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 md:p-10">
        <div className="text-base md:text-lg font-bold tracking-tight text-zinc-800 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          上海市民办高校新联会
        </div>
        <div className="text-sm md:text-base font-bold tracking-tight text-zinc-400">
          2026
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-0">
        
        <FloatingCards />

        {/* Center Text */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center z-20 max-w-4xl mx-auto w-full relative"
        >
          {/* Protective glow to ensure text readability against floating cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[160%] bg-white/90 blur-3xl rounded-full pointer-events-none -z-10"></div>

          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-zinc-200 bg-white/50 backdrop-blur-sm text-sm font-bold text-zinc-500 tracking-widest uppercase shadow-sm">
            第三届大学生
          </div>
          
          <h1
            className="text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] tracking-tight mb-6 text-zinc-900 flex flex-row items-center justify-center gap-4 sm:gap-8 drop-shadow-sm flex-wrap"
            style={{ fontFamily: "'ZCOOL XiaoWei', serif" }}
          >
            <span>非遗</span>
            <span className="text-orange-500 font-serif italic font-light text-5xl sm:text-7xl md:text-8xl lg:text-[8rem]">&</span>
            <span>文创</span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl font-medium text-zinc-500 mb-1 tracking-wide">
            非遗文化创新作品大赛
          </p>
          <p className="text-base sm:text-lg font-bold text-orange-500 mb-3 tracking-widest">
            新力量·新传承
          </p>
          <p className="text-sm sm:text-base text-zinc-400 mb-12 tracking-widest">
            明信片、书签、冰箱贴、徽章、帆布袋等
          </p>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="group relative inline-flex items-center justify-center px-10 py-5 text-lg md:text-xl font-black text-white transition-all duration-300 bg-orange-600 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-600 hover:bg-orange-700 shadow-2xl shadow-orange-600/30 overflow-hidden"
          >
            <span className="relative z-10 flex items-center">
              作品申报入口
              <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
          </motion.button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end p-6 md:p-10 mt-auto text-xs md:text-sm text-zinc-400 gap-6 text-center md:text-left bg-gradient-to-t from-white/80 to-transparent pt-20">
        <div className="max-w-2xl space-y-1.5">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">组织架构</p>
          <p><span className="font-semibold text-zinc-500">指导单位：</span>上海市教委民办教育管理处（民办教育综合党委办公室）</p>
          <p><span className="font-semibold text-zinc-500">主办单位：</span>上海市民办高校新的社会阶层人士联谊会</p>
          <p><span className="font-semibold text-zinc-500">承办单位：</span>新联会上海师范大学天华学院分会</p>
          <p><span className="font-semibold text-zinc-500">协办单位：</span>新联会上海建桥学院分会、上海震旦职业学院分会、上海外国语大学贤达人文学院分会</p>
        </div>
        <div className="md:text-right space-y-2">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">活动时间</p>
          <p className="font-mono text-zinc-500 bg-zinc-100 px-3 py-1 rounded-md inline-block">2026 年 4 月 — 6 月</p>
          <p className="text-xs text-zinc-400 mt-1">作品提交截止：<span className="font-semibold text-orange-500">2026 年 5 月 31 日 24:00</span></p>
        </div>
      </footer>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <SubmitModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
