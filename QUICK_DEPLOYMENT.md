# 🚀 快速部署指南 - UI 视觉回归测试平台

## 📋 当前状态

✅ **已完成**：
- 项目代码已准备就绪
- Git 仓库已初始化
- GitHub Actions 工作流已配置
- 所有文件已提交

⏳ **需要你完成**：
- 创建 GitHub 仓库
- 推送代码
- 配置 GitHub Pages
- 配置自定义域名（可选）

---

## 🎯 完整部署步骤（请按顺序执行）

### 第一步：创建 GitHub 仓库

1. **访问**：https://github.com/new
2. **填写仓库信息**：
   - Repository name: `ui-visual-regression-tester`
   - Description: `UI Visual Regression Testing Platform`
   - **Public/Private**: 选择 **Private**（推荐，仅你和团队可见）
   - **不要**勾选任何其他选项
3. 点击 **Create repository**

### 第二步：推送代码到 GitHub

在终端中执行以下命令：

```bash
cd /Users/admin/Desktop/workbuddy\ test/ui-visual-regression-tester

# 添加远程仓库
git remote add origin https://github.com/virkyvv/ui-visual-regression-tester.git

# 推送代码
git branch -M main
git push -u origin main
```

**如果需要登录**：
- 执行 `git push -u origin main` 时，GitHub 会要求你认证
- 选择使用 **GitHub CLI** 或 **Personal Access Token**
- 按照提示完成认证

### 第三步：配置 GitHub Pages

1. **访问仓库设置**：
   - 打开：https://github.com/virkyvv/ui-visual-regression-tester/settings/pages

2. **配置部署设置**：
   - 在 **Build and deployment** 部分
   - **Source**: 选择 **GitHub Actions**（推荐）或 **Deploy from a branch**
   
   **如果选择 GitHub Actions**（推荐）：
   - 点击 Save
   - GitHub 会自动使用 `.github/workflows/deploy.yml` 文件
   - 自动化构建和部署

   **如果选择 Deploy from a branch**：
   - **Branch**: 选择 `main`
   - **Folder**: 选择 `/ (root)`
   - 点击 Save

3. **等待部署**：
   - 访问 **Actions** 标签页查看部署状态
   - 通常需要 1-3 分钟
   - 部署成功后会显示绿色勾号 ✅

### 第四步：访问你的网站

🎉 **部署成功后，你的网站地址是**：

```
https://virkyvv.github.io/ui-visual-regression-tester/
```

**复制上面的网址，在浏览器中打开即可访问！**

---

## 🌐 配置自定义域名

如果你有自己的域名，可以按以下步骤配置：

### 方式 1：顶级域名（如 yourdomain.com）

1. **在 GitHub Pages 中添加域名**：
   - 访问：https://github.com/virkyvv/ui-visual-regression-tester/settings/pages
   - 在 **Custom domain** 输入框中输入你的域名
   - 点击 Save

2. **配置 DNS 记录**：
   - 登录你的域名管理后台
   - 添加以下 **A 记录**（共 4 条）：
   
   | 主机记录 | 类型 | 记录值 | TTL |
   |---------|------|--------|-----|
   | @ | A | 185.199.108.153 | 600 |
   | @ | A | 185.199.109.153 | 600 |
   | @ | A | 185.199.110.153 | 600 |
   | @ | A | 185.199.111.153 | 600 |

3. **等待 DNS 生效**（通常 24-48 小时）

4. **启用 HTTPS**：
   - 在 GitHub Pages 设置中找到 **Enforce HTTPS**
   - 勾选此项

### 方式 2：子域名（如 app.yourdomain.com）

1. **在 GitHub Pages 中添加域名**：
   - 输入：`app.yourdomain.com`
   - 点击 Save

2. **配置 DNS 记录**：
   - 添加一条 **CNAME 记录**：
   
   | 主机记录 | 类型 | 记录值 | TTL |
   |---------|------|--------|-----|
   | app | CNAME | virkyvv.github.io | 600 |

3. **等待 DNS 生效并启用 HTTPS**

---

## 🔍 验证部署

### 1. 检查部署状态
- 访问：https://github.com/virkyvv/ui-visual-regression-tester/actions
- 查看最新的工作流状态（绿色✅表示成功）

### 2. 测试网站功能
打开你的网站，测试以下功能：
- ✅ 上传设计稿
- ✅ 上传开发预览图（支持拖拽、粘贴、URL 加载、设备投屏）
- ✅ 执行视觉对比
- ✅ 查看对比结果
- ✅ 删除已上传的图片
- ✅ 批量对比功能

---

## 📱 分享给团队

**网站地址**：
```
https://virkyvv.github.io/ui-visual-regression-tester/
```

**如果你配置了自定义域名**：
```
https://yourdomain.com/
```

直接将网址分享给团队成员即可使用！

---

## 🔄 自动部署

配置完成后，每次你推送代码到 `main` 分支时，网站会自动更新：

```bash
# 修改代码后
git add .
git commit -m "Update website"
git push origin main

# 网站会自动更新！
```

---

## 🆘 常见问题

### Q1: 推送代码时提示认证失败
**解决方案**：
1. 安装 GitHub CLI：`brew install gh`
2. 登录：`gh auth login`
3. 重新执行：`git push -u origin main`

### Q2: 网站显示 404 错误
**解决方案**：
1. 检查 GitHub Pages 设置中的分支是否为 `main`
2. 等待几分钟让 GitHub 完成部署
3. 查看 Actions 页面的部署日志

### Q3: 自定义域名无法访问
**解决方案**：
1. 检查 DNS 记录是否正确配置
2. 使用 `dig yourdomain.com` 检查 DNS 解析
3. 等待 DNS 生效（可能需要 24-48 小时）

### Q4: HTTPS 无法启用
**解决方案**：
1. 确认 DNS 记录已正确配置
2. 等待 DNS 完全生效
3. 检查是否有其他 DNS 记录冲突

---

## 📞 需要帮助？

- GitHub Pages 官方文档：https://docs.github.com/pages
- GitHub Actions 文档：https://docs.github.com/actions
- 查看部署日志：https://github.com/virkyvv/ui-visual-regression-tester/actions

---

## ✅ 完成清单

- [ ] 创建 GitHub 仓库
- [ ] 推送代码到 GitHub
- [ ] 配置 GitHub Pages
- [ ] 验证网站可访问
- [ ] 测试所有功能
- [ ] （可选）配置自定义域名
- [ ] （可选）启用 HTTPS
- [ ] 分享网址给团队

---

**准备好了吗？开始部署吧！🚀**
