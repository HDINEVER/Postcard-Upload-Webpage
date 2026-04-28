import { Client, Databases, Storage, ID } from 'appwrite';

const configuredEndpoint = (
  import.meta.env.VITE_APPWRITE_URL ||
  import.meta.env.VITE_APPWRITE_ENDPOINT ||
  'https://appwrite1.hdinever.ccwu.cc/v1'
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
    video: (import.meta.env.VITE_APPWRITE_BUCKET_VIDEO || '69e1b6c80005490899cc').trim(),
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

// 2 MB per chunk — balances speed (~8 requests for 15 MB) and reliability:
// each chunk at 2 Mbps takes ~8 s, well under Cloudflare's 100 s proxy timeout.
// (500 KB = 30 requests; 5 MB = 3 requests but triggers CF 499 on slow connections)
const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024;
const CHUNK_REQUEST_TIMEOUT_MS = 120_000;
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

// Turnstile sitekey — set VITE_TURNSTILE_SITEKEY in .env
const TURNSTILE_SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY || '').trim();

// Cache the token; Turnstile tokens are valid for ~5 min.
let _turnstileToken: string | null = null;
let _turnstileExpiry = 0;

export async function getTurnstileToken(): Promise<string | null> {
  if (!TURNSTILE_SITEKEY) return null;
  if (_turnstileToken && Date.now() < _turnstileExpiry) return _turnstileToken;

  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.opacity = '0';
    document.body.appendChild(container);

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (container.parentNode) document.body.removeChild(container);
        resolve(null);
      }
    }, 4000); // 4秒超时，防止阻塞上传

    if (typeof window !== 'undefined' && (window as any).turnstile) {
       (window as any).turnstile.render(container, {
        sitekey: TURNSTILE_SITEKEY,
        callback: (token: string) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          _turnstileToken = token;
          _turnstileExpiry = Date.now() + 4 * 60 * 1000;
          document.body.removeChild(container);
          resolve(token);
        },
        'error-callback': () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          document.body.removeChild(container);
          resolve(null);
        },
        execution: 'execute',
        appearance: 'always', // 始终渲染，但容器是隐藏的
      });
    } else {
      resolved = true;
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

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

      // Cloudflare challenge page — retrying makes it worse; surface immediately.
      const isCloudflareChallenge =
        body.includes('just a moment') ||
        body.includes('Just a moment') ||
        body.includes('challenges.cloudflare.com') ||
        (response.status === 403 && body.startsWith('<!DOCTYPE html'));
      if (isCloudflareChallenge) {
        throw {
          message: 'Cloudflare 拦截了上传请求（Bot Protection 触发）。请在 Cloudflare 控制台 Security → WAF 中为 /v1/* 路径创建 Skip Bot Fight Mode 规则，或临时将该 API 域名的安全级别调低。',
          code: 403,
          type: 'cloudflare_challenge',
        };
      }

      let parsedMessage = body;
      try {
        const json = JSON.parse(body);
        if (json?.message) parsedMessage = json.message;
      } catch { /* not JSON */ }

      let parsedType: string | undefined;
      try { parsedType = JSON.parse(body)?.type; } catch { /* not JSON */ }

      const err = {
        message: parsedMessage || response.statusText,
        code: response.status,
        type: parsedType,
      };

      // Non-retriable errors (4xx except 499): propagate immediately, no point in retrying
      const retriable = response.status === 499 || response.status === 502 || response.status === 503 || response.status === 504;
      if (!retriable) {
        console.error('[Appwrite] Upload failed (non-retriable):', {
          status: response.status,
          type: parsedType,
          message: parsedMessage,
          range: `${start}-${end - 1}/${totalSize}`,
        });
        throw err;
      }

      lastError = err;
      if (attempt === MAX_CHUNK_RETRIES) {
        break;
      }
    } catch (error) {
      clearTimeout(timeout);
      // If this is our own non-retriable throw, propagate it immediately
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code: unknown }).code === 'number'
      ) {
        throw error;
      }
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

  // Preserve the original error so normalizeSubmissionError can decode it
  if (lastError !== undefined) throw lastError;
  throw new Error(`分块上传失败: ${start}-${end - 1}/${totalSize}`);
}

async function uploadFileChunked(
  bucketId: string,
  fileId: string,
  file: File,
  onProgress?: (pct: number) => void,
  displayFileName?: string,
  providedTurnstileToken?: string,
): Promise<Record<string, unknown>> {
  const endpoint = appwriteConfig.endpoint;
  const projectId = appwriteConfig.projectId;
  const totalSize = file.size;
  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
  const fileName = displayFileName || file.name;

  if (totalSize === 0) {
    throw new Error('文件大小为 0，请重新选择文件');
  }

  const turnstileToken = providedTurnstileToken || (await getTurnstileToken());
  const baseHeaders: Record<string, string> = {
    ...APPWRITE_SDK_HEADERS,
    'X-Appwrite-Project': projectId,
    ...(turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : {}),
  };

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

  let fileObj: Record<string, unknown> | null = null;
  let uploadedFileId: string | null = null;

  for (let start = 0; start < totalSize; start += UPLOAD_CHUNK_SIZE) {
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', new File([chunk], fileName, { type: file.type || 'application/octet-stream' }));

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
      `Appwrite 未配置完整，请在 .env 中补齐以下变量: appwrite1.hdinever.ccwu.cc`
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
      if (appwriteError.message.includes('SchoolName')) {
        return new Error('提交失败：所选学校与 Appwrite 集合允许值不一致，请重新选择学校后再试。');
      }
      return new Error(`提交失败：${appwriteError.message}`);
    }

    if (appwriteError.code === 404 && appwriteError.type === 'general_route_not_found') {
      return new Error('提交失败：Appwrite 文档接口未找到。');
    }

    if (appwriteError.type === 'cloudflare_challenge') {
      return new Error(appwriteError.message);
    }

    if (appwriteError.code === 401 || appwriteError.code === 403) {
      return new Error(`文件上传被拒绝 (${appwriteError.code})：存储桶权限不足，请在 Appwrite 控制台检查。`);
    }

    if (appwriteError.code === 499 || appwriteError.message.includes('Client Closed Request')) {
      return new Error('上传超时：服务器关闭了连接，请重试或上传较小的文件。');
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('提交失败，请检查网络连通性');
}

function sanitizeFileNamePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function startFileUpload(
  category: string,
  file: File,
  onProgress?: (pct: number) => void,
  name?: string,
  studentId?: string,
  turnstileToken?: string,
): Promise<{ fileId: string; bucketId: string; displayFileName: string }> {
  try {
    assertAppwriteConfigured();
    const selectedBucketId = categoryToBucketId[category];
    if (!selectedBucketId) {
      throw new Error('参赛类别无效');
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
    await uploadFileChunked(selectedBucketId, fileId, file, onProgress, displayFileName, turnstileToken);
    return { fileId, bucketId: selectedBucketId, displayFileName };
  } catch (error) {
    throw normalizeSubmissionError(error);
  }
}

export async function finalizeFileSubmission({
  name,
  phone,
  school,
  studentId,
  teacher,
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
  category: string;
  fileId: string;
  bucketId: string;
  originalFileName: string;
  onProgress?: (pct: number) => void;
}) {
  try {
    assertAppwriteConfigured();
    onProgress?.(50);
    const entry = await databases!.createDocument(
      config.databaseId,
      config.collectionId,
      fileId,
      {
        name,
        tel: phone,
        SchoolName: school,
        schoolNum: studentId,
        TeacherId: teacher || '',
        videoUrl: '',
      },
    );
    onProgress?.(100);
    return { success: true, entry };
  } catch (error) {
    throw normalizeSubmissionError(error);
  }
}

export async function submitEntry({
  name,
  phone,
  school,
  studentId,
  teacher,
  category,
  videoUrl,
  onProgress,
  onStageChange,
}: {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  teacher?: string;
  category: string;
  file: File | null;
  videoUrl?: string;
  onProgress?: (progress: number) => void;
  onStageChange?: (stage: 'uploading' | 'saving') => void;
}) {
  try {
    assertAppwriteConfigured();
    const entryId = ID.unique();

    if (category === 'video') {
      onStageChange?.('saving');
      onProgress?.(50);
      const entry = await databases!.createDocument(
        config.databaseId,
        config.collectionId,
        entryId,
        {
          name,
          tel: phone,
          SchoolName: school,
          schoolNum: studentId,
          TeacherId: teacher || '',
          videoUrl: videoUrl || '',
        }
      );
      onProgress?.(100);
      return { success: true, entry };
    }
    return { success: false };
  } catch (error) {
    throw normalizeSubmissionError(error);
  }
}

export function getFileDownloadUrl(fileId: string, bucketId: string): string {
  return `${configuredEndpoint}/storage/buckets/${bucketId}/files/${fileId}/download`;
}
