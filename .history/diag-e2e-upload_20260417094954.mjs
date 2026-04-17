import { readFileSync } from 'fs';

function parseEnv(path) {
  const text = readFileSync(path, 'utf8');
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const env = parseEnv('.env');
const endpoint = env.VITE_APPWRITE_URL;
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const databaseId = env.VITE_APPWRITE_DATABASE_ID;
const collectionId = env.VITE_APPWRITE_COLLECTION_ID;
const postcardBucketId = env.VITE_APPWRITE_BUCKET_POSTCARD;
const pptBucketId = env.VITE_APPWRITE_BUCKET_PPT;

const sdkHeaders = {
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Response-Format': '1.9.0',
  'x-sdk-name': 'Web',
  'x-sdk-platform': 'client',
  'x-sdk-language': 'web',
  'x-sdk-version': '24.1.1',
};

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function req(url, init = {}) {
  const started = Date.now();
  const res = await fetch(url, init);
  const ms = Date.now() - started;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = { message: '(non-json response)' };
  }
  return { res, body, ms };
}

async function testHealth() {
  const { res, ms, body } = await req(`${endpoint}/health`, { headers: sdkHeaders });
  console.log(`HEALTH: HTTP ${res.status} time=${ms}ms`);
  if (!res.ok) {
    console.log(`  message: ${body?.message || '(none)'}`);
  }
}

async function testListFiles(bucketId, name) {
  const { res, body, ms } = await req(`${endpoint}/storage/buckets/${bucketId}/files`, { headers: sdkHeaders });
  console.log(`LIST ${name}: HTTP ${res.status} time=${ms}ms`);
  if (!res.ok) {
    console.log(`  message: ${body?.message || '(none)'} type=${body?.type || '(none)'}`);
  } else {
    console.log(`  total field seen: ${typeof body?.total !== 'undefined' ? body.total : '(unknown)'}`);
  }
}

async function uploadChunked(bucketId, fileId, fileName, mimeType, totalSize) {
  const CHUNK = 500 * 1024;
  const payload = new Uint8Array(totalSize).fill(65);
  const bigBlob = new Blob([payload], { type: mimeType });
  const fullFile = new File([bigBlob], fileName, { type: mimeType });

  const url = `${endpoint}/storage/buckets/${bucketId}/files`;
  let uploadedId = null;

  for (let start = 0; start < totalSize; start += CHUNK) {
    const end = Math.min(start + CHUNK, totalSize);
    const chunk = fullFile.slice(start, end);
    const form = new FormData();
    form.append('fileId', fileId);
    form.append('file', new File([chunk], fileName, { type: mimeType }));

    const headers = {
      ...sdkHeaders,
      'content-range': `bytes ${start}-${end - 1}/${totalSize}`,
    };
    if (uploadedId) headers['x-appwrite-id'] = uploadedId;

    const { res, body, ms } = await req(url, { method: 'POST', headers, body: form });
    console.log(`UPLOAD CHUNK ${start}-${end - 1}/${totalSize}: HTTP ${res.status} time=${ms}ms`);
    if (!res.ok) {
      console.log(`  message: ${body?.message || '(none)'} type=${body?.type || '(none)'} code=${body?.code || '(none)'}`);
      return { ok: false, body };
    }
    if (body?.$id) uploadedId = body.$id;
  }

  return { ok: true, uploadedId };
}

async function createDoc(documentId, schoolNum, videoUrl) {
  const url = `${endpoint}/databases/${databaseId}/collections/${collectionId}/documents`;
  const data = {
    documentId,
    data: {
      name: '联调测试',
      tel: '13800138000',
      schoolName: '上海建桥学院',
      schoolNum,
      videoUrl,
    },
  };

  const { res, body, ms } = await req(url, {
    method: 'POST',
    headers: { ...sdkHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  console.log(`CREATE DOC: HTTP ${res.status} time=${ms}ms`);
  if (!res.ok) {
    console.log(`  message: ${body?.message || '(none)'} type=${body?.type || '(none)'} code=${body?.code || '(none)'}`);
  } else {
    console.log(`  docId: ${body?.$id || '(none)'}`);
  }
}

async function main() {
  console.log('==== E2E Upload Diagnostic Start ====');
  console.log(`endpoint=${endpoint}`);
  console.log(`projectId=${projectId}`);
  console.log(`database=${databaseId} collection=${collectionId}`);
  console.log(`postcardBucket=${postcardBucketId}`);
  console.log(`pptBucket=${pptBucketId}`);
  console.log('');

  await testHealth();
  await testListFiles(postcardBucketId, 'postcard');
  await testListFiles(pptBucketId, 'presentation');

  console.log('\n---- Simulate postcard flow (upload + create doc) ----');
  const postcardEntryId = randomId('diag_postcard');
  const upload1 = await uploadChunked(
    postcardBucketId,
    postcardEntryId,
    `${postcardEntryId}.jpg`,
    'image/jpeg',
    620 * 1024
  );
  if (upload1.ok) {
    console.log(`UPLOAD RESULT postcard fileId=${upload1.uploadedId}`);
    await createDoc(postcardEntryId, `PC_${Date.now()}`, '');
  }

  console.log('\n---- Simulate presentation flow (upload + create doc) ----');
  const pptEntryId = randomId('diag_ppt');
  const upload2 = await uploadChunked(
    pptBucketId,
    pptEntryId,
    `${pptEntryId}.pdf`,
    'application/pdf',
    620 * 1024
  );
  if (upload2.ok) {
    console.log(`UPLOAD RESULT presentation fileId=${upload2.uploadedId}`);
    await createDoc(pptEntryId, `PP_${Date.now()}`, '');
  }

  console.log('\n==== E2E Upload Diagnostic End ====');
}

main().catch((e) => {
  console.error('FATAL', e?.message || e);
  process.exit(1);
});
