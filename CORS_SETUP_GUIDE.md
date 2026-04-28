# 🔧 CORS 错误解决指南

## ❌ 错误信息

```
Access to fetch at 'https://appwrite1.hdinever.ccwu.cc/v1/storage/buckets/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🎯 问题原因

Appwrite 项目没有将前端应用的域名（`localhost:3000`）添加到允许访问的平台列表中。

---

## ✅ 解决步骤（必须操作）

### 步骤 1: 登录 Appwrite 控制台

访问：**https://appwrite1.hdinever.ccwu.cc**

使用你的管理员账号登录。

---

### 步骤 2: 选择项目

在控制台首页，找到并点击你的项目：

- **项目 ID:** `69dc5b0700295f5740d0`

---

### 步骤 3: 添加 Web 平台

1. 在左侧菜单中，点击 **Settings**（设置）

2. 在设置页面，找到并点击 **Platforms**（平台）标签

3. 点击右上角的 **Add Platform**（添加平台）按钮

4. 在弹出的对话框中，选择 **Web App**

5. 填写平台信息：

   | 字段 | 值 | 说明 |
   |------|---|------|
   | **Name** | `本地开发` | 平台名称，可以自定义 |
   | **Hostname** | `localhost` | **关键配置** |
   
   > ⚠️ **重要提示：**
   > - 开发环境可以填写 `localhost`（不需要端口号）
   > - 或者使用通配符 `*` 允许所有域名（仅开发环境推荐）
   > - **不要**填写 `http://localhost:3000`，只填写域名部分

6. 点击 **Create** 或 **Save** 保存

---

### 步骤 4: 配置权限（如果还有错误）

#### 4.1 配置 Collection 权限

1. 在左侧菜单中，点击 **Databases**
2. 选择数据库 `69de43e100124b512cbb`
3. 点击 Collection: `project`
4. 点击 **Settings** → **Permissions** 标签
5. 点击 **Add Role**
6. 配置权限：
   - **Role Type:** 选择 `Any`（任何人）
   - **Permissions:** 勾选以下权限
     - ✅ `Create` (创建文档)
     - ✅ `Read` (读取文档)
7. 点击 **Save**

#### 4.2 配置 Storage Buckets 权限

对 **每个** 存储桶重复以下步骤：

**存储桶列表：**
- `69df42a60004a562ba07` (明信片设计)
- `69df430100088d621422` (演示文稿演讲)
- `69df4311003df133de23` (项目上传视频)

**配置步骤：**
1. 在左侧菜单中，点击 **Storage**
2. 选择对应的存储桶
3. 点击 **Settings** → **Permissions** 标签
4. 点击 **Add Role**
5. 配置权限：
   - **Role Type:** 选择 `Any`（任何人）
   - **Permissions:** 勾选以下权限
     - ✅ `Create` (上传文件)
     - ✅ `Read` (读取文件)
6. 点击 **Save**

---

### 步骤 5: 验证配置

1. **刷新浏览器页面** - 按 `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac) 强制刷新

2. **重新测试上传功能：**
   - 访问 http://localhost:3000
   - 点击"立即报名"
   - 填写表单
   - 上传文件
   - 点击"确认提交"

3. **检查浏览器控制台** (按 F12)
   - 如果没有 CORS 错误，说明配置成功！
   - 如果还有错误，查看下方的故障排查部分

---

## 🚀 生产环境配置

如果需要部署到生产环境，还需要添加生产域名：

1. 进入 **Settings** → **Platforms**
2. 再次点击 **Add Platform** → **Web App**
3. 填写：
   - **Name:** `生产环境`
   - **Hostname:** `你的域名.com` （不包括 `https://` 和路径）
4. 保存

**示例：**
- ✅ 正确：`example.com`
- ✅ 正确：`app.example.com`
- ❌ 错误：`https://example.com`
- ❌ 错误：`example.com/app`

---

## 🔍 故障排查

### 问题 1: 添加平台后仍然有 CORS 错误

**解决方法：**
1. 确认 Hostname 填写的是 `localhost` 而不是 `http://localhost:3000`
2. 清除浏览器缓存并强制刷新（Ctrl+Shift+R）
3. 重启开发服务器（`npm run dev`）
4. 等待 1-2 分钟让 Appwrite 配置生效

### 问题 2: 提示权限不足 (401 Unauthorized)

**解决方法：**
- 检查 Collection 和 Storage Buckets 的权限设置
- 确保添加了 `Any` 角色的 `Create` 和 `Read` 权限

### 问题 3: 找不到 Platforms 设置

**解决方法：**
- 确认你是项目的管理员或所有者
- 确认 Appwrite 版本 >= 1.0
- 尝试在 **Project Settings** 或 **Overview** 页面查找

---

## 📋 配置检查清单

完成配置后，请确认：

- [ ] Appwrite 项目已添加 Web 平台
- [ ] Hostname 设置为 `localhost` 或 `*`
- [ ] Collection `project` 有 `Any` 角色的 `Create` 和 `Read` 权限
- [ ] 3 个 Storage Buckets 都有 `Any` 角色的 `Create` 和 `Read` 权限
- [ ] 浏览器已强制刷新（Ctrl+Shift+R）
- [ ] 开发服务器已重启

---

## 📞 需要帮助？

如果按照以上步骤操作后仍有问题，请提供：

1. 浏览器控制台的完整错误信息（按 F12 查看）
2. Appwrite 平台配置的截图
3. Appwrite 权限配置的截图

这样我可以帮你进一步诊断问题！
