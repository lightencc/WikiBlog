---
name: openclaw-papermod-publisher
description: Transform curated articles from WeChat, X, and expert blogs into PaperMod-style markdown posts and publish them to a WikiBlog endpoint through /api/v1/articles. Use when an agent must clean source material, standardize title/summary/tags/metadata, preserve source attribution, and upload or verify publication automatically.
---

# OpenClaw PaperMod Publisher

## Overview

将多平台文章整理成统一的 PaperMod 风格内容，并调用上传 API 发布到个人站。

## Workflow

1. 读取原始材料：网页正文、作者、发布时间、来源链接。
2. 提炼结构化信息：`title`、`summary`、`tags`、`source`、`contentMarkdown`。
3. 按站点风格重写正文：先结论后展开，使用 `##` 和 `###` 分段。
4. 检查来源字段：必须保留 `source.platform`、`source.name`、`source.url`。
5. 执行上传：调用 `scripts/publish_article.py` 或直接 POST API。
6. 访问返回的 URL：确认页面可访问且元信息完整。

## Content Rules

- 使用信息密度高的标题，避免“XX分享”“一些思考”这类弱标题。
- 摘要限制在 1 到 2 句，优先回答“这篇值不值得看”。
- 正文默认结构：
  - `## 为什么值得收藏`
  - `## 核心观点`
  - `## 可执行启发`
- 保留原文关键事实，不捏造数据、公司名、时间。
- 结尾补一段来源说明，确保读者可追溯。

具体版式细则见 `references/style-guide.md`。

## API Usage

上传接口与字段约束见 `references/api-contract.md`。

常用上传命令：

```bash
python3 scripts/publish_article.py \
  --api http://localhost:4321/api/v1/articles \
  --input /absolute/path/to/article.json
```

若服务启用了 API key：

```bash
python3 scripts/publish_article.py \
  --api http://localhost:4321/api/v1/articles \
  --api-key "$OPENCLAW_API_KEY" \
  --input /absolute/path/to/article.json
```

## Validation Checklist

上传前后都执行以下检查：

- 字段完整：`title`、`summary`、`contentMarkdown`、`source.url`
- Markdown 结构：至少一个 `##` 二级标题
- 标签质量：2 到 6 个，避免重复
- 可访问性：返回 `201` 且 `url` 能打开
- 追溯性：页面包含来源区块和外链

## Resources

- `references/style-guide.md`: PaperMod 风格写作和排版约束。
- `references/api-contract.md`: 上传 API 的请求/响应规范。
- `scripts/publish_article.py`: 将 JSON 内容上传到站点 API。
