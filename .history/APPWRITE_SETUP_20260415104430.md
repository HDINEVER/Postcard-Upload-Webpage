# Appwrite 后端集成指南

## 概述

本项目已集成 Appwrite 后端，用于处理参赛作品的提交和存储。

## 系统需求

- **Appwrite** 版本 >= 1.0
- 已配置的 Appwrite 项目
- 有效的 API 密钥和访问权限

## 环境配置

### 1. 获取 Appwrite 配置信息

在 Appwrite 控制台中获取以下信息：

| 配置项 | 说明 | 获取方式 |
|--------|------|--------|
| `VITE_APPWRITE_URL` | Appwrite 后端地址 | 通常为 `https://your-domain.com/v1` |
| `VITE_APPWRITE_PROJECT_ID` | 项目 ID | 项目设置 → Project ID |
| `VITE_APPWRITE_DATABASE_ID` | 数据库 ID | 数据库 → 选择数据库 → Database ID |
| `VITE_APPWRITE_COLLECTION_ID` | 集合 ID | 数据库 → 选择集合 → Collection ID |
| `VITE_APPWRITE_BUCKET_ID` | 存储桶 ID | 存储 → 选择桶 → Bucket ID |

### 2. 设置环境变量

编辑 `.env` 文件：

```env
# Appwrite Configuration
VITE_APPWRITE_URL=https://your-appwrite-domain.com/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=your_database_id
VITE_APPWRITE_COLLECTION_ID=your_collection_id
VITE_APPWRITE_BUCKET_ID=your_bucket_id
```

## 数据库 Schema

### Collection: submissions

存储所有参赛作品提交记录。

**必需属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | String | 参赛者姓名 |
| `phone` | String | 联系电话 |
| `school` | String | 所在学校 |
| `student_id` | String | 学号 |
| `category` | String | 参赛类别 (postcard/presentation/video) |
| `file_id` | String | 存储中的文件 ID |
| `file_name` | String | 原始文件名 |
| `file_size` | Integer | 文件大小 (字节) |
| `submitted_at` | String | 提交时间 (ISO 8601) |

**示例创建 SQL：**

```sql
CREATE COLLECTION submissions (
  name: String,
  phone: String,
  school: String,
  student_id: String,
  category: Enum ['postcard', 'presentation', 'video'],
  file_id: String,
  file_name: String,
  file_size: Integer,
  submitted_at: String
)
```

## 存储桶配置

### Bucket: submissions

存储上传的参赛作品文件。

**推荐配置：**
- **最大文件大小**：200 MB (根据需求调整)
- **允许的文件类型**：
  - 明信片: JPG, PNG
  - 演示文稿: PDF, PPT, PPTX, DOC, DOCX
  - 视频: ZIP (打包文件)
- **加密**：建议启用
- **病毒扫描**：可选启用（如可用）

**权限设置：**

确保集合和存储桶有适当的权限配置：

```json
{
  "read": ["role:all"],
  "write": ["role:all"]
}
```

或针对更严格的访问控制，创建自定义规则。

## API 密钥要求

创建或使用现有的 API 密钥需要以下权限：

### 必需作用域：

- `databases.read`
- `databases.write`
- `collections.read`
- `documents.read`
- `documents.write`
- `files.read`
- `files.write`
- `buckets.read`
- `buckets.write`

### 创建步骤：

1. 登录 Appwrite 控制台
2. 转到 Settings → API Keys
3. 点击 "Create API Key"
4. 输入名称 (例如："PostcardUploadApp")
5. 选择上述所有作用域
6. 点击 Create

**安全建议：**
- 不要在客户端代码中暴露敏感的 API 密钥
- 在客户端应用中使用 Appwrite 提供的公开 API
- 大量操作建议使用服务器端 API

## 使用 API

### 提交作品

```typescript
import { submitEntry } from './lib/appwrite';

const result = await submitEntry({
  name: 'John Doe',
  phone: '13800138000',
  school: '你的大学',
  studentId: '2024001',
  category: 'postcard',
  file: fileObject,
});

console.log('提交成功:', result);
```

### 获取文件下载 URL

```typescript
import { getFileDownloadUrl } from './lib/appwrite';

const downloadUrl = getFileDownloadUrl(fileId);
window.location.href = downloadUrl;
```

## 错误处理

应用会捕获以下常见错误：

| 错误 | 原因 | 解决方案 |
|------|------|--------|
| 认证失败 | 无效的项目 ID 或 URL | 检查 `.env` 配置 |
| 权限不足 | API 密钥权限不足 | 检查 API 密钥的作用域 |
| 文件过大 | 上传文件超过大小限制 | 检查存储桶配置的文件大小限制 |
| 网络错误 | 无法连接到 Appwrite | 检查 URL 和网络连接 |

## 测试连接

在项目根目录运行：

```bash
npm run dev
```

打开浏览器，点击 "作品申报入口" 按钮，填写表格并尝试上传。如果配置正确，应能成功提交。

## 常见问题

### Q: 如何验证环境变量是否正确加载？
A: 在浏览器控制台执行 `console.log(import.meta.env)` 并检查 `VITE_APPWRITE_*` 值。

### Q: 文件上传失败，显示 "权限不足"
A: 确保：
- API 密钥有 `files.write` 权限
- 存储桶 ID 正确
- 存储桶权限允许写入

### Q: 如何在后端列出所有提交？
A: 使用 Appwrite REST API 或任何 SDK：

```bash
curl -X GET 'https://your-appwrite-domain.com/v1/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents' \
  -H 'X-Appwrite-Project: {PROJECT_ID}' \
  -H 'X-Appwrite-Key: {YOUR_API_KEY}'
```

## 安全建议

1. **不要在前端存储敏感密钥**
   - 如需严格控制，使用服务器端 API

2. **启用文件病毒扫描**
   - 在 Appwrite 中启用 ClamAV 集成

3. **设置文件大小限制**
   - 防止滥用存储空间

4. **启用 CORS**
   - 确保 Appwrite 服务器配置允许来自前端域的请求

5. **添加服务器端验证**
   - 不要仅依赖客户端验证

## 生产部署

### 1. 验证所有环境变量

```bash
npm run lint
```

### 2. 构建项目

```bash
npm run build
```

### 3. 测试构建输出

```bash
npm run preview
```

### 4. 确保 CORS 配置

在 Appwrite 控制台，Settings → Domains，添加生产域名。

### 5. 启用 HTTPS

Appwrite 和前端应用都应使用 HTTPS。

## 相关文档链接

- [Appwrite 官方文档](https://appwrite.io/docs)
- [Appwrite Studio](https://cloud.appwrite.io)
- [Appwrite JavaScript SDK](https://github.com/appwrite/sdk-for-web)
- [我们的 Appwrite 集成代码](./src/lib/appwrite.ts)

## 支持

如有问题，请：
1. 检查浏览器控制台错误信息
2. 验证 Appwrite 服务器状态
3. 确认所有环境变量配置正确
4. 查看 Appwrite 服务器日志
