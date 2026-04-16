/**
 * Bucket-only Appwrite upload diagnostic
 * Usage: node test-file-upload.js
 */

const ENDPOINT = 'https://appwrite1.hdinever.top/v1';
const PROJECT_ID = '69dc5b0700295f5740d0';

const BUCKETS = {
  video: '69df4311003df133de23',
  presentation: '69df430100088d621422',
  postcard: '69df42a60004a562ba07',
};

const BASE_HEADERS = {
  'X-Appwrite-Project': PROJECT_ID,
};

const log = {
  ok: (s) => console.log(`  [OK] ${s}`),
  info: (s) => console.log(`  [..] ${s}`),
  fail: (s) => console.log(`  [XX] ${s}`),
  section: (s) => console.log(`\n${'='.repeat(60)}\n  ${s}\n${'='.repeat(60)}`),
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    ...options,
    headers: { ...BASE_HEADERS, ...(options.headers || {}) },
    redirect: 'manual',
  });

  const ct = res.headers.get('content-type') || '';
  let body;
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = '<empty>';
  }

  return { status: res.status, headers: res.headers, body };
}

async function checkReachability() {
  log.section('Step 1: server reachability');
  const { status, headers, body } = await apiFetch('/health');
  log.info(`GET /health -> ${status}`);

  if (status === 200 || status === 401) {
    log.ok('Server reachable');
    if (typeof body === 'object' && body && body.version) {
      log.info(`Appwrite version: ${body.version}`);
    }
    return true;
  }

  if (status >= 300 && status < 400) {
    const loc = headers.get('location') || '';
    log.fail(`Redirected to: ${loc}`);
    if (loc.includes('cloudflareaccess') || loc.includes('cdn-cgi/access/login')) {
      log.fail('Blocked by Cloudflare Access before Appwrite');
    }
    return false;
  }

  log.fail(`Unexpected /health status: ${status}`);
  log.info(`Response: ${JSON.stringify(body)}`);
  return false;
}

function buildTestFile(kind) {
  if (kind === 'video') {
    return {
      fileName: 'diag-video.mp4',
      blob: new Blob(['diag video payload'], { type: 'video/mp4' }),
    };
  }

  if (kind === 'presentation') {
    return {
      fileName: 'diag-slides.pptx',
      blob: new Blob(['diag ppt payload'], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    };
  }

  return {
    fileName: 'diag-postcard.jpg',
    blob: new Blob(['diag postcard payload'], { type: 'image/jpeg' }),
  };
}

function explainUploadError(status, body) {
  if (status === 401 || status === 403) {
    return 'Permission denied: bucket File Security / Create permission may not allow guests.';
  }

  if (status === 404) {
    return 'Bucket id not found.';
  }

  if (status === 413) {
    return 'File too large for bucket max file size.';
  }

  if (status === 400 && body && typeof body === 'object') {
    const msg = String(body.message || 'Bad request');
    if (msg.toLowerCase().includes('mime')) {
      return 'MIME type blocked by bucket allowed file types.';
    }
    if (msg.toLowerCase().includes('extension')) {
      return 'File extension blocked by bucket allowed file extensions.';
    }
    return `Validation failed: ${msg}`;
  }

  return `Unexpected error: ${JSON.stringify(body)}`;
}

async function uploadOne(kind, bucketId) {
  log.section(`Step 2: upload test file to bucket [${kind}] ${bucketId}`);

  const { fileName, blob } = buildTestFile(kind);
  const form = new FormData();
  form.append('fileId', 'unique()');
  form.append('file', blob, fileName);

  const { status, body } = await apiFetch(`/storage/buckets/${bucketId}/files`, {
    method: 'POST',
    body: form,
  });

  log.info(`POST /storage/buckets/${bucketId}/files -> ${status}`);

  if (status === 201) {
    log.ok(`Upload success for [${kind}]`);
    log.ok(`File id: ${body.$id}`);

    const del = await apiFetch(`/storage/buckets/${bucketId}/files/${body.$id}`, {
      method: 'DELETE',
    });

    if (del.status === 204) {
      log.ok('Cleanup success (test file deleted)');
    } else {
      log.info(`Cleanup response: ${del.status}`);
    }

    return true;
  }

  log.fail(`Upload failed for [${kind}]`);
  log.fail(explainUploadError(status, body));
  if (body && typeof body === 'object' && body.message) {
    log.info(`Server message: ${body.message}`);
  }
  return false;
}

(async () => {
  console.log('\nAppwrite bucket upload diagnostic');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project: ${PROJECT_ID}`);

  const reachable = await checkReachability();
  if (!reachable) {
    console.log('\nStop: server unreachable from current path.\n');
    process.exit(1);
  }

  const results = [];
  for (const [kind, bucketId] of Object.entries(BUCKETS)) {
    const ok = await uploadOne(kind, bucketId);
    results.push({ kind, bucketId, ok });
  }

  log.section('Summary');
  for (const item of results) {
    const mark = item.ok ? '[OK]' : '[XX]';
    console.log(`  ${mark} ${item.kind} -> ${item.bucketId}`);
  }

  console.log('\nDone.\n');
})();
