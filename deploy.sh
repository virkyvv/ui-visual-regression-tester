#!/bin/bash

# UI 视觉回归测试平台 - 快速部署脚本

echo "🚀 开始部署到 GitHub Pages..."
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查是否已初始化 Git
if [ ! -d ".git" ]; then
    echo "📦 初始化 Git 仓库..."
    git init
    git add .
    git commit -m "Initial commit - UI Visual Regression Tester"
    echo "✅ Git 仓库初始化完成"
fi

# 检查远程仓库
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE_URL" ]; then
    echo ""
    echo "📝 请按以下步骤操作："
    echo ""
    echo "1. 访问 https://github.com/new 创建新仓库"
    echo "2. 仓库名称：ui-visual-regression-tester"
    echo "3. 建议设置为 Private（私有仓库）"
    echo "4. 创建后，复制仓库 URL（格式：https://github.com/你的用户名/ui-visual-regression-tester.git）"
    echo ""
    read -p "请输入你的 GitHub 仓库 URL: " REPO_URL

    if [ -z "$REPO_URL" ]; then
        echo "❌ 仓库 URL 不能为空"
        exit 1
    fi

    git remote add origin "$REPO_URL"
    echo "✅ 远程仓库已添加"
fi

# 构建项目
echo ""
echo "🔨 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建成功"

# 推送到 GitHub
echo ""
echo "📤 推送到 GitHub..."

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 发现未提交的更改，正在提交..."
    git add .
    git commit -m "Update and deploy"
fi

# 推送到 main 分支
git branch -M main
git push -u origin main

if [ $? -ne 0 ]; then
    echo "❌ 推送失败，请检查你的 GitHub 凭证"
    exit 1
fi

echo "✅ 推送成功"

# 提示用户配置 GitHub Pages
echo ""
echo "🎉 代码已推送到 GitHub！"
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 访问你的 GitHub 仓库："
git remote get-url origin
echo ""
echo "2. 点击 Settings → Pages"
echo "3. 在 Build and deployment 部分："
echo "   - Source: 选择 GitHub Actions（推荐）或 Deploy from a branch"
echo "   - 如果选择 Deploy from a branch，Branch 选择 main，目录选择 / (root)"
echo ""
echo "4. 保存设置，等待 1-3 分钟完成部署"
echo ""
echo "🌐 部署完成后，你的网站地址将是："
echo "   https://$(git remote get-url origin | sed -E 's|https://github.com/(.+)/.*|github.com/\1|' | sed 's|github.com|\1.github.io|').github.io/ui-visual-regression-tester/"
echo ""
echo "💡 查看部署状态："
echo "   - 访问仓库的 Actions 标签页"
echo "   - 查看 Pages 标签页的部署状态"
echo ""
