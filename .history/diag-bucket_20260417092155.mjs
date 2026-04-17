import { readFileSync } from 'fs';

// Read .env manually
const envContent = readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx === -1) return;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
});

const endpoint = env.VITE_APPWRITE_URL;
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const buckets = {
  postcard:     { id: env.VITE_APPWRITE_BUCKET_POSTCARD,  mime: 'image/jpeg',              ext: 'jpg' },
  presentation: { id: env.VITE_APPWRITE_BUCKET_PPT,       mime: 'application/pdf',         ext: 'pdf' },
};

console.log('=== Config Check ===');
console.log('endpoint   :', endpoint);
console.log('projectId  :', projectId);
console.log('postcard   :', buckets.postcard.id);
console.log('presentation:', buckets.presentation.id);
console.log('');

const SDK_HEADERS = {
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Response-Format': '1.9.0',
  'x-sdk-name': 'Web',
  'x-sdk-platform': 'client',
  'x-sdk-language': 'web',
  'x-sdk-version': '24.1.1',
};

async function testBucketMeta(name, bucketId) {
  const url = `${endpoint}/storage/buckets/${bucketId}`;
  try {
    const res = await fetch(url, { headers: SDK_HEADERS });
    const json = await res.json().catch(() => ({}));
    const allowed = json.allowedFileExtensions || [];
    console.log(`[${name}] GET /buckets/${bucketId} → HTTP ${res.status}`);
    if (res.ok) {
      console.log(`  name           :`, json.name);
      console.log(`  enabled        :`, json.enabled);
      console.log(`  allowedExt     :`, allowed.length ? allowed.join(', ') : '(全部允许)');
      console.log(`  maximumFileSize:`, json.maximumFileSize ? `${(json.maximumFileSize / 1024 / 1024).toFixed(1)} MB` : '无限制');
    } else {
      console.log(`  error:`, json.message || JSON.stringify(json));
    }
  } catch (e) {
    console.log(`[${name}] 连接失败:`, e.message);
  }
}

async function testUpload(name, bucketId, mimeType, ext) {
  const blob = new Blob(['DIAG_TEST_BYTE'], { type: mimeType });
  const file = new File([blob], `diag_test.${ext}`, { type: mimeType });
  const form = new FormData();
  form.append('fileId', 'diag-test-00001');
  form.append('file', file);

  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
  try {
    const res = await fetch(url, { method: 'POST', headers: SDK_HEADERS, body: form });
    const json = await res.json().catch(() => ({}));
    console.log(`[${name}] POST upload .${ext} → HTTP ${res.status}`);
    if (res.ok) {
      console.log(`  OK  fileId=${json.$id}  name=${json.name}  size=${json.sizeOriginal}`);
      // cleanup
      const del = await fetch(`${url}/${json.$id}`, { method: 'DELETE', headers: SDK_HEADERS });
      console.log(`  DEL cleanup → HTTP ${del.status}`);
    } else {
      console.log(`  FAIL message="${json.message}"  type="${json.type}"  code=${json.code}`);
    }
  } catch (e) {
    console.log(`[${name}] upload 异常:`, e.message);
  }
}

// Also test a chunked upload (2 chunks at 500KB chunk size, using a ~600KB synthetic file)
async function testChunkedUpload(name, bucketId, mimeType, ext) {
  const CHUNK = 500 * 1024;
  const totalSize = CHUNK + 100; // 2 chunks
  const buf = new Uint8Array(totalSize).fill(65); // fill with 'A'
  const blob = new Blob([buf], { type: mimeType });
  const file = new File([blob], `diag_chunked.${ext}`, { type: mimeType });

  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
  let uploadedId = null;

  console.log(`[${name}] Chunked upload (${(totalSize/1024).toFixed(0)} KB, 2 chunks)`);

  for (let start = 0; start < totalSize; start += CHUNK) {
    const end = Math.min(start + CHUNK, totalSize);
    const chunk = file.slice(start, end);
    const form = new FormData();
    form.append('fileId', 'diag-chunk-00001');
    form.append('file', new File([chunk], file.name, { type: mimeType }));

    const headers = {
      ...SDK_HEADERS,
      'content-range': `bytes ${start}-${end - 1}/${totalSize}`,
    };
    if (uploadedId) headers['x-appwrite-id'] = uploadedId;

    try {
      const res = await fetch(url, { method: 'POST', headers, body: form });
      const json = await res.json().catch(() => ({}));
      console.log(`  chunk ${start}-${end - 1}/${totalSize} → HTTP ${res.status}`);
      if (res.ok) {
        if (json.$id) uploadedId = json.$id;
      } else {
        console.log(`  FAIL message="${json.message}"  type="${json.type}"  code=${json.code}`);
        return;
      }
    } catch (e) {
      console.log(`  chunk 异常:`, e.message);
      return;
    }
  }

  if (uploadedId) {
    console.log(`  ALL CHUNKS OK  fileId=${uploadedId}`);
    const del = await fetch(`${url}/${uploadedId}`, { method: 'DELETE', headers: SDK_HEADERS });
    console.log(`  DEL cleanup → HTTP ${del.status}`);
  }
}

(async () => {
  for (const [name, { id, mime, ext }] of Object.entries(buckets)) {
    await testBucketMeta(name, id);
    console.log('');
    await testUpload(name, id, mime, ext);
    console.log('');
    await testChunkedUpload(name, id, mime, ext);
    console.log('');
  }
})();
