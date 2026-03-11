# WikiBlog Prototype (PaperMod-Style + OpenClaw API)

这是一个第一版原型，用于复刻 [ainews.qiaomu.ai](https://ainews.qiaomu.ai/) 的核心视觉风格与信息结构，并直接从 Obsidian 知识库拉取文章展示。

## 当前能力

- 首页列表页：超宽封面 + 标题 + 摘要 + 阅读元信息（更高文字密度）
- 文章详情页：标题区、目录、正文、来源、标签、上一篇/下一篇
- 分类页：`/categories/` 与分类文章页
- 标签页：`/tags/` 与标签文章页
- 搜索页：`/search/?q=关键词`（支持标题/摘要/标签/分类/正文检索）
- Obsidian 数据源：自动读取知识库下“带 emoji 的文件夹”中的 `.md` 文章
- 主题切换：亮色/暗色
- 移动端菜单：汉堡菜单自适应
- OpenClaw 上传 API：`POST /api/v1/articles`
- 本地内容库：上传后自动落盘到 `content/posts/*.md`（可作为补充来源）

## 快速启动

```bash
npm install
npm run dev
```

默认地址：`http://localhost:4321`

默认 Obsidian 路径：

- `OBSIDIAN_VAULT_PATH=/Users/ellachan/Documents/Obsidian/cc/知识库`

可选环境变量：

```bash
OBSIDIAN_VAULT_PATH="/your/vault/path" npm run dev
```

## API

### 1) 健康检查

```bash
curl http://localhost:4321/api/v1/health
```

### 2) 上传文章

```bash
curl -X POST http://localhost:4321/api/v1/articles \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "OpenClaw 上传测试：一篇新文章",
    "summary": "这是一篇通过 API 上传的文章示例。",
    "author": "爱吃鱼的龙虾哥",
    "categories": ["AI Agent"],
    "tags": ["AI", "收藏"],
    "publishedAt": "2026-02-17T10:00:00+08:00",
    "source": {
      "platform": "x",
      "name": "@example",
      "url": "https://x.com/"
    },
    "contentMarkdown": "## 正文标题\n\n这是正文。"
  }'
```

### 3) 搜索 API

```bash
curl 'http://localhost:4321/api/v1/search?q=工作流'
```

### 4) API Key（可选）

如果设置了环境变量 `OPENCLAW_API_KEY`，上传接口将校验 `x-api-key`。

```bash
OPENCLAW_API_KEY=demo-key npm run dev
```

## 目录结构

```text
.
├── content/posts/                # 文章 markdown
├── public/assets/css/            # 样式（含 PaperMod 基线）
├── public/assets/js/             # 交互脚本
├── src/lib/articles.js           # 内容读取/渲染/保存
├── src/views/                    # 列表页、正文页模板
├── skills/openclaw-papermod-publisher/
│   ├── SKILL.md                  # 给 Agent 的操作规范
│   ├── references/               # 风格与 API 参考
│   └── scripts/                  # 上传脚本
└── docs/site-analysis.md         # 目标站调研结论
```

## 部署

RackNerd VPS 部署脚本与 Cloudflare 域名绑定说明见：

- `docs/deploy-racknerd.md`

## 下一步（建议）

1. 接入真实抓取器（微信公众号/X/博客 URL -> 清洗正文）。
2. 增加去重策略（按 `source.url` + `title hash`）。
3. 增加审阅流（draft/review/published 状态）。
4. 补全文站检索（tags/source/topic）。
