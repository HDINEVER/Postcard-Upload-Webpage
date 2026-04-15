# API 密钥检查清单

## 必需的配置

### ✅ 步骤 1: 获取 Appwrite 配置信息

- [ ] 登录 Appwrite 控制台
- [ ] 复制 **Project ID**
- [ ] 复制 **Database ID**
- [ ] 复制 **Collection ID** (收集提交数据)
- [ ] 复制 **Bucket ID** (存储文件)
- [ ] 记录 **Appwrite URL** (通常为 `https://your-domain.com/v1`)

### ✅ 步骤 2: 创建/验证 API 密钥

**必需权限范围：**
```
✓ auth.read
✓ auth.write
✓ users.read
✓ users.write
✓ databases.read
✓ databases.write
✓ collections.read
✓ documents.read
✓ documents.write
✓ files.read
✓ files.write
✓ buckets.read
✓ buckets.write
```

### ✅ 步骤 3: 配置环境变量

在项目根目录的 `.env` 文件中填入：

```env
VITE_APPWRITE_URL=https://your-appwrite-domain.com/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
VITE_APPWRITE_DATABASE_ID=your_database_id_here
VITE_APPWRITE_COLLECTION_ID=your_collection_id_here
VITE_APPWRITE_BUCKET_ID=your_bucket_id_here
GEMINI_API_KEY=your_gemini_key_here
```

### ✅ 步骤 4: 验证数据库 Schema

您的 Collection 应包含以下字段：
- `name` (String) - 参赛者姓名
- `phone` (String) - 联系电话  
- `school` (String) - 所在学校
- `student_id` (String) - 学号
- `category` (String) - 参赛类别
- `file_id` (String) - 文件 ID
- `file_name` (String) - 文件名
- `file_size` (Integer) - 文件大小
- `submitted_at` (String) - 提交时间

### ✅ 步骤 5: 验证存储桶配置

- [ ] 存储桶已创建
- [ ] 最大文件大小 ≥ 200MB
- [ ] 允许文件类型包括: JPG, PNG, PDF, PPT, ZIP
- [ ] 设置了合适的权限规则

### ✅ 步骤 6: 测试连接

1. 启动开发服务器
```bash
npm run dev
```

2. 打开应用
3. 点击 "作品申报入口"
4. 填写测试表单
5. 尝试上传文件
6. 验证成功消息

## 常见配置错误

### ❌ 错误 1: 认证失败
**症状**: 控制台显示 "Unauthorized"
**检查项**:
- [ ] Project ID 正确
- [ ] Appwrite URL 正确 (包含 `/v1`)
- [ ] `.env` 文件已保存
- [ ] 重启开发服务器: `npm run dev`

### ❌ 错误 2: 文件上传失败
**症状**: 上传时显示 "Permission denied"
**检查项**:
- [ ] 存储桶 ID 正确
- [ ] API 密钥有 `files.write` 权限
- [ ] 存储桶权限设置允许写入
- [ ] 文件大小在限制范围内

### ❌ 错误 3: 数据无法保存
**症状**: 表单提交后没有数据出现
**检查项**:
- [ ] Database ID 正确
- [ ] Collection ID 正确  
- [ ] API 密钥有 `documents.write` 权限
- [ ] Collection 包含所需字段

### ❌ 错误 4: CORS 错误
**症状**: 浏览器控制台显示 CORS 错误
**解决方案**:
- 在 Appwrite Settings → Domains 添加您的应用域名
- 确保应用使用正确的协议 (http/https)

## 快速诊断脚本

在浏览器控制台运行以诊断问题：

```javascript
// 检查环境变量
console.log('=== 环境变量检查 ===');
console.log('URL:', import.meta.env.VITE_APPWRITE_URL);
console.log('Project ID:', import.meta.env.VITE_APPWRITE_PROJECT_ID);
console.log('Database ID:', import.meta.env.VITE_APPWRITE_DATABASE_ID);
console.log('Collection ID:', import.meta.env.VITE_APPWRITE_COLLECTION_ID);
console.log('Bucket ID:', import.meta.env.VITE_APPWRITE_BUCKET_ID);

// 测试连接
import { client } from './lib/appwrite.ts';
console.log('Client config:', {
  endpoint: client.config.endpoint,
  project: client.config.project
});
```

## 需要帮助？

如果以上步骤无法解决问题，请提供：
1. 浏览器控制台的完整错误信息
2. 验证的所有配置字段（不包括敏感信息）
3. Appwrite 服务器日志截图
4. 测试的文件类型和大小
