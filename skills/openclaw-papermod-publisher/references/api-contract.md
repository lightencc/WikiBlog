# API Contract

Base URL 示例：`http://localhost:4321`

## 1. Health

`GET /api/v1/health`

成功响应：

```json
{
  "ok": true,
  "service": "wikiblog-prototype"
}
```

## 2. Upload Article

`POST /api/v1/articles`

Headers:

- `Content-Type: application/json`
- `x-api-key: <key>` (仅当服务设置了 `OPENCLAW_API_KEY`)

Body:

```json
{
  "title": "string, required",
  "summary": "string, optional",
  "author": "string, optional",
  "slug": "string, optional",
  "tags": ["string"],
  "publishedAt": "ISO date string, optional",
  "readingTimeMinutes": "number, optional",
  "wordCount": "number, optional",
  "coverImage": "string url, optional",
  "language": "string, optional",
  "source": {
    "platform": "wechat|x|blog|other",
    "name": "string",
    "url": "string"
  },
  "contentMarkdown": "string, required"
}
```

成功响应（201）：

```json
{
  "ok": true,
  "slug": "generated-slug",
  "url": "/posts/generated-slug/"
}
```

失败响应（400/401）：

```json
{
  "error": "message"
}
```

## 3. List Articles

`GET /api/v1/articles`

返回文章列表（不含完整正文）。

## 4. Get Article

`GET /api/v1/articles/:slug`

返回单篇文章详情（含 `contentMarkdown`）。
