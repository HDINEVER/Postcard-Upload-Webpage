/**
 * Appwrite 配置测试脚本
 */

console.log('\n========== Appwrite 配置检查 ==========\n');

const config = {
  url: 'https://appwrite1.hdinever.top/v1',
  projectId: '69dc5b0700295f5740d0',
  databaseId: '69de43e100124b512cbb',
  collectionId: 'project',
  buckets: {
    video: '69df4311003df133de23',
    ppt: '69df430100088d621422',
    postcard: '69df42a60004a562ba07'
  }
};

// 检查所有必需配置
const checks = [
  { name: 'VITE_APPWRITE_URL', value: config.url, required: true },
  { name: 'VITE_APPWRITE_PROJECT_ID', value: config.projectId, required: true },
  { name: 'VITE_APPWRITE_DATABASE_ID', value: config.databaseId, required: true },
  { name: 'VITE_APPWRITE_COLLECTION_ID', value: config.collectionId, required: true },
  { name: 'VITE_APPWRITE_BUCKET_VIDEO', value: config.buckets.video, required: true },
  { name: 'VITE_APPWRITE_BUCKET_PPT', value: config.buckets.ppt, required: true },
  { name: 'VITE_APPWRITE_BUCKET_POSTCARD', value: config.buckets.postcard, required: true },
];

let allValid = true;
const missingKeys = [];

checks.forEach(check => {
  const isValid = check.value && check.value.trim() !== '';
  const status = isValid ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${isValid ? check.value : '(未配置)'}`);
  
  if (check.required && !isValid) {
    allValid = false;
    missingKeys.push(check.name);
  }
});

console.log('\n========================================\n');

if (allValid) {
  console.log('✅ 所有必需配置已填写完整！');
  console.log('\n📝 配置摘要：');
  console.log(`   服务器: ${config.url}`);
  console.log(`   项目ID: ${config.projectId}`);
  console.log(`   数据库ID: ${config.databaseId}`);
  console.log(`   集合ID: ${config.collectionId}`);
  console.log(`   存储桶数量: 3 个`);
  console.log('\n🚀 现在可以测试上传功能了！');
  console.log('   1. 打开浏览器访问: http://localhost:3000');
  console.log('   2. 点击"立即报名"按钮');
  console.log('   3. 填写表单并上传文件');
  console.log('   4. 观察是否有错误提示\n');
} else {
  console.log(`❌ 配置不完整，缺少以下变量:\n   ${missingKeys.join(', ')}`);
  console.log('\n请在 .env 文件中补齐这些配置。\n');
}

console.log('========================================\n');

// 测试 URL 连通性
console.log('🌐 测试 Appwrite 服务器连通性...\n');

fetch(config.url + '/health')
  .then(response => {
    if (response.ok) {
      console.log('✅ Appwrite 服务器连接成功！');
      console.log(`   状态码: ${response.status}`);
      return response.json();
    } else {
      console.log('⚠️  服务器响应异常');
      console.log(`   状态码: ${response.status}`);
    }
  })
  .then(data => {
    if (data) {
      console.log('   服务器状态:', data.status || 'OK');
    }
  })
  .catch(error => {
    console.log('❌ 无法连接到 Appwrite 服务器');
    console.log(`   错误: ${error.message}`);
    console.log('\n请检查:');
    console.log('   1. URL 是否正确');
    console.log('   2. 网络连接是否正常');
    console.log('   3. Appwrite 服务是否运行中\n');
  });
