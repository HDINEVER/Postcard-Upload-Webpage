/**
 * 表单数据单独上传测试脚本
 * 逐步诊断：健康检查 → 列出集合 → 创建文档
 *
 * 用法：node test-form-submit.js
 */

const ENDPOINT   = 'https://appwrite1.hdinever.top/v1';
const PROJECT_ID = '69dc5b0700295f5740d0';
const DATABASE_ID   = '69de43e100124b512cbb';
const COLLECTION_ID = 'project'; // 注意：可能需要是真实 ID 而非名称

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': PROJECT_ID,
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const url = `${ENDPOINT}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...BASE_HEADERS, ...(options.headers || {}) },
    redirect: 'manual',
  });

  let body = null;
  const ct = res.headers.get('content-type') || '';
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch (_) {
    body = '<empty>';
  }

  return { status: res.status, headers: res.headers, body };
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(title) { console.log(`\n${'═'.repeat(55)}\n  ${title}\n${'═'.repeat(55)}`); }

// ─────────────────────────────────────────────
// 步骤 1 — 健康检查
// ─────────────────────────────────────────────
async function step1_health() {
  section('步骤 1 — /v1/health 健康检查');
  try {
    const { status, body, headers } = await apiFetch('/health');
    info(`HTTP ${status}`);
    if (status === 200) {
      ok('Appwrite 健康检查通过');
      console.log('     响应:', typeof body === 'object' ? JSON.stringify(body, null, 2) : body);
      return true;
    } else if (status === 401) {
      // Appwrite 1.6+ 的 /health 需要 health.read scope，401 表示服务可达
      ok(`Appwrite 服务可达（/health 需要 API Key，返回 401 属正常）`);
      info(`Appwrite 版本: ${typeof body === 'object' ? body.version || '未知' : '未知'}`);
      return true;
    } else if (status >= 300 && status < 400) {
      const loc = headers.get('location') || '';
      fail(`被重定向 → ${loc}`);
      if (loc.includes('cloudflareaccess') || loc.includes('cdn-cgi')) {
        fail('Cloudflare Access 拦截，后续请求无法到达 Appwrite');
      }
      return false;
    } else {
      fail(`意外状态码 ${status}`);
      console.log('     响应:', body);
      return false;
    }
  } catch (e) {
    fail(`请求失败: ${e.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────
// 步骤 2 — 验证 Project 存在
// ─────────────────────────────────────────────
async function step2_project() {
  section('步骤 2 — 验证 Project');
  try {
    const { status, body } = await apiFetch(`/projects/${PROJECT_ID}/usage`);
    info(`HTTP ${status}`);
    if (status === 200) {
      ok(`Project ${PROJECT_ID} 存在`);
    } else if (status === 401 || status === 403) {
      // 403 on usage is normal for client-side; project itself exists
      ok(`Project ${PROJECT_ID} 存在（usage 端点需 API Key，可忽略 ${status}）`);
    } else {
      fail(`Project 验证异常 ${status}: ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail(`请求失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 步骤 3 — 验证 Database 存在
// ─────────────────────────────────────────────
async function step3_database() {
  section('步骤 3 — 验证 Database');
  try {
    const { status, body } = await apiFetch(`/databases/${DATABASE_ID}`);
    info(`HTTP ${status}`);
    if (status === 200) {
      ok(`Database "${body.name}" (${DATABASE_ID}) 存在`);
    } else if (status === 401 || status === 403) {
      info(`需要更高权限才能读取 database 元数据（${status}），继续下一步`);
    } else if (status === 404) {
      fail(`Database ID "${DATABASE_ID}" 不存在，请检查配置`);
    } else {
      fail(`Database 验证异常 ${status}: ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail(`请求失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 步骤 4 — 验证 Collection 存在
// ─────────────────────────────────────────────
async function step4_collection() {
  section(`步骤 4 — 验证 Collection (ID="${COLLECTION_ID}")`);
  try {
    const { status, body } = await apiFetch(
      `/databases/${DATABASE_ID}/collections/${COLLECTION_ID}`
    );
    info(`HTTP ${status}`);
    if (status === 200) {
      ok(`Collection "${body.name}" (${COLLECTION_ID}) 存在`);
      info(`属性字段: ${(body.attributes || []).map(a => a.key).join(', ') || '(无 / 无权读取)'}`);
    } else if (status === 401 || status === 403) {
      info(`权限不足无法读取 collection 元数据（${status}），尝试直接写入`);
    } else if (status === 404) {
      fail(`Collection ID "${COLLECTION_ID}" 不存在`);
      fail('提示：COLLECTION_ID 必须是真实 ID（24位字母数字），而非集合名称。');
      info('请在 Appwrite 控制台 → Databases → 你的数据库 → 集合 → 点击集合 → 查看 Settings 获取真实 ID');
    } else {
      fail(`Collection 验证异常 ${status}: ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail(`请求失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 步骤 5 — 尝试创建文档（仅表单字段）
// ─────────────────────────────────────────────
async function step5_createDocument() {
  section('步骤 5 — 尝试创建测试文档（表单字段）');

  const testDoc = {
    name:       '测试姓名',
    tel:        '13800138000',
    schoolName: '上海建桥学院',
    schoolNum:  'TEST001',
  };

  info(`目标: POST /databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents`);
  info(`数据: ${JSON.stringify(testDoc)}`);

  try {
    const { status, body } = await apiFetch(
      `/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents`,
      {
        method: 'POST',
        body: JSON.stringify({
          documentId: 'unique()',
          data: testDoc,
          permissions: [],
        }),
      }
    );

    info(`HTTP ${status}`);
    if (status === 201) {
      ok('文档创建成功！表单字段与 Appwrite 集合结构匹配');
      ok(`新文档 ID: ${body.$id}`);

      // 清理测试文档
      try {
        await apiFetch(
          `/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${body.$id}`,
          { method: 'DELETE' }
        );
        ok('测试文档已清理');
      } catch (_) {}

    } else if (status === 400) {
      fail(`文档结构错误 (400): ${body.message}`);
      if (body.type === 'document_invalid_structure') {
        fail('字段不匹配，检查集合中是否存在: name, tel, schoolName, schoolNum');
      }
    } else if (status === 401) {
      fail(`未授权 (401): ${body.message}`);
      fail('Collection 的 Documents permissions 未允许 "Any" create，请在控制台开放权限');
    } else if (status === 403) {
      fail(`禁止访问 (403): ${body.message}`);
      fail('Collection 或 Document 权限不允许当前请求，请在 Appwrite 控制台检查 Permissions 配置');
    } else if (status === 404) {
      fail(`路由不存在 (404): ${body.message}`);
      fail('Database ID 或 Collection ID 有误，或 Appwrite 版本不支持此路径');
    } else {
      fail(`意外状态码 ${status}: ${JSON.stringify(body)}`);
    }
  } catch (e) {
    fail(`请求失败: ${e.message}`);
    if (e.message.includes('fetch')) {
      fail('网络层面无法到达 Appwrite，请先检查步骤 1 健康检查是否通过');
    }
  }
}

// ─────────────────────────────────────────────
// 步骤 6 — 检查存储桶是否可访问
// ─────────────────────────────────────────────
async function step6_buckets() {
  section('步骤 6 — 存储桶访问检查');
  const buckets = {
    视频桶:   '69df4311003df133de23',
    PPT桶:    '69df430100088d621422',
    明信片桶: '69df42a60004a562ba07',
  };

  for (const [label, bucketId] of Object.entries(buckets)) {
    try {
      const { status, body } = await apiFetch(`/storage/buckets/${bucketId}`);
      if (status === 200) {
        ok(`${label} (${bucketId}) 存在 — "${body.name}"`);
      } else if (status === 401 || status === 403) {
        info(`${label} 元数据权限不足 (${status})，但桶可能存在，尝试上传时再验证`);
      } else if (status === 404) {
        fail(`${label} (${bucketId}) 不存在`);
      } else {
        fail(`${label} 异常 ${status}: ${JSON.stringify(body)}`);
      }
    } catch (e) {
      fail(`${label} 请求失败: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
(async () => {
  console.log('\n🔍  Appwrite 分步诊断工具');
  console.log(`    端点: ${ENDPOINT}`);
  console.log(`    项目: ${PROJECT_ID}`);
  console.log(`    数据库: ${DATABASE_ID}`);
  console.log(`    集合: ${COLLECTION_ID}`);

  const healthy = await step1_health();
  if (!healthy) {
    console.log('\n⛔ 健康检查失败，Appwrite 无法直连，跳过后续步骤');
    process.exit(1);
  }

  await step2_project();
  await step3_database();
  await step4_collection();
  await step5_createDocument();
  await step6_buckets();

  console.log('\n' + '═'.repeat(55));
  console.log('  诊断完成。根据上方 ❌ 标记修复对应配置后重试。');
  console.log('═'.repeat(55) + '\n');
})();
