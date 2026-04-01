# UI 视觉回归测试平台 - 部署到 GitHub Pages

本指南将帮助你将 UI 视觉回归测试平台部署到 GitHub Pages，并配置自定义域名。

## 📋 前置要求

- GitHub 账号
- Git 已安装
- 自定义域名（可选）

## 🚀 部署步骤

### 第一步：初始化 Git 仓库

```bash
cd ui-visual-regression-tester
git init
git add .
git commit -m "Initial commit - UI Visual Regression Tester"
```

### 第二步：创建 GitHub 仓库

1. 访问 [GitHub](https://github.com/) 并登录
2. 点击右上角的 `+` 号，选择 `New repository`
3. 填写仓库信息：
   - **Repository name**: `ui-visual-regression-tester`
   - **Description**: `UI Visual Regression Testing Platform`
   - **Public/Private**: 建议选择 Private（仅供团队使用）
   - **不要**勾选 `Add a README file`（我们已经有了）
4. 点击 `Create repository`

### 第三步：推送代码到 GitHub

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/ui-visual-regression-tester.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 第四步：配置 GitHub Pages

1. 在 GitHub 仓库页面，点击 `Settings` 标签
2. 在左侧菜单中找到 `Pages`
3. 在 `Build and deployment` 部分配置：
   - **Source**: 选择 `Deploy from a branch`
   - **Branch**: 选择 `main`，目录选择 `/ (root)`
4. 点击 `Save`

### 第五步：等待部署完成

- GitHub 会自动开始部署
- 通常需要 1-3 分钟
- 刷新页面后，你会看到部署成功的提示和网站地址

🎉 **你的网站现在可以通过以下地址访问**：
```
https://YOUR_USERNAME.github.io/ui-visual-regression-tester/
```

---

## 🌐 配置自定义域名

如果你有自己的域名，可以按照以下步骤配置：

### 方式 1：使用顶级域名（如 example.com）

1. **在 GitHub Pages 设置中添加域名**：
   - 进入仓库的 `Settings` → `Pages`
   - 在 `Custom domain` 输入框中输入你的域名：`example.com`
   - 点击 `Save`

2. **在域名服务商处配置 DNS**：
   - 登录你的域名管理后台
   - 添加一条 A 记录：
     - **类型**: A
     - **主机记录**: `@`
     - **记录值**: `185.199.108.153`
     - **TTL**: 600（或默认值）

   添加以下四条 A 记录（确保稳定）：
   ```
   @ → 185.199.108.153
   @ → 185.199.109.153
   @ → 185.199.110.153
   @ → 185.199.111.153
   ```

3. **启用 HTTPS**（强烈推荐）：
   - 在 GitHub Pages 设置中找到 `Enforce HTTPS`
   - 等待 DNS 生效（可能需要几小时到几天）
   - 勾选 `Enforce HTTPS`

### 方式 2：使用子域名（如 app.example.com）

1. **在 GitHub Pages 设置中添加域名**：
   - 输入：`app.example.com`
   - 点击 `Save`

2. **在域名服务商处配置 DNS**：
   - 添加一条 CNAME 记录：
     - **类型**: CNAME
     - **主机记录**: `app`
     - **记录值**: `YOUR_USERNAME.github.io`
     - **TTL**: 600（或默认值）

3. **启用 HTTPS**：
   - 等待 DNS 生效
   - 勾选 `Enforce HTTPS`

---

## 🔄 自动部署配置（推荐）

配置自动部署后，每次推送到 `main` 分支都会自动更新网站。

### 1. 创建 GitHub Actions 工作流

在项目根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 2. 更新 GitHub Pages 设置

1. 进入仓库的 `Settings` → `Pages`
2. 在 `Build and deployment` 部分选择：
   - **Source**: 选择 `GitHub Actions`
3. 保存设置

---

## 📊 访问控制选项

### 1. 设置仓库为私有

- 在仓库设置中，将仓库改为 Private
- 只有有权限的 GitHub 用户才能访问

### 2. 使用 GitHub 的访问控制（仅 Organization 账号）

如果你的网站需要公开访问，但只有特定用户可以使用某些功能，可以在应用中添加简单的登录验证。

---

## 🧪 验证部署

1. **检查部署状态**：
   - 进入仓库的 `Actions` 标签
   - 查看最新的部署工作流状态

2. **访问网站**：
   - 使用 GitHub Pages 地址：`https://YOUR_USERNAME.github.io/ui-visual-regression-tester/`
   - 或使用自定义域名（如果已配置）

3. **测试功能**：
   - 上传设计稿和开发图
   - 测试对比功能
   - 测试剪贴板粘贴功能
   - 测试设备投屏功能

---

## 🐛 常见问题

### 问题 1：网站显示 404

**解决方案**：
- 检查 GitHub Pages 设置中的分支和目录是否正确
- 等待几分钟让 GitHub 完成部署
- 查看 Actions 标签页，确认部署是否成功

### 问题 2：自定义域名无法访问

**解决方案**：
- 使用 `dig` 或 `nslookup` 命令检查 DNS 解析：
  ```bash
  dig yourdomain.com
  ```
- 确认 DNS 记录已生效（可能需要 24-48 小时）
- 检查 GitHub Pages 设置中的自定义域名状态

### 问题 3：HTTPS 无法启用

**解决方案**：
- 确认 DNS 记录已正确配置
- 等待 DNS 完全生效（通常需要几小时到几天）
- 确保没有其他 DNS 记录冲突

### 问题 4：图片上传功能不工作

**解决方案**：
- 由于 GitHub Pages 是静态网站，某些功能可能需要调整
- 检查浏览器的开发者工具控制台是否有错误
- 确认浏览器支持所需的 API（如 FileReader、Canvas 等）

---

## 📝 总结

✅ **完成部署后**：
- 网站可以通过 `https://YOUR_USERNAME.github.io/ui-visual-regression-tester/` 访问
- 每次推送到 `main` 分支都会自动更新
- 可以配置自定义域名
- 建议设置为 Private 仓库以保证安全

🎯 **下一步**：
1. 测试所有功能
2. 分享网址给团队成员
3. 根据需求配置访问控制
4. 定期更新和维护

---

**需要帮助？**
- GitHub Pages 官方文档：https://docs.github.com/pages
- GitHub Actions 文档：https://docs.github.com/actions
- 如有问题，请查看 GitHub Actions 的日志输出
