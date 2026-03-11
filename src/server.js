const path = require("node:path");
const express = require("express");
const fs = require("node:fs");
const { siteConfig, storageConfig } = require("./config");
const {
  getAllArticles,
  readArticleBySlug,
  getNeighborArticles,
  getAllTags,
  getAllCategories,
  getTagBySlug,
  getCategoryBySlug,
  searchArticles,
  saveArticle
} = require("./lib/articles");

const app = express();
const port = Number(process.env.PORT || 4321);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/assets", express.static(path.join(process.cwd(), "public", "assets")));

if (fs.existsSync(storageConfig.obsidianRootPath)) {
  app.use(
    "/obsidian-files",
    express.static(storageConfig.obsidianRootPath, {
      fallthrough: true
    })
  );
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function requireApiKey(req, res, next) {
  const expected = process.env.OPENCLAW_API_KEY;

  if (!expected) {
    next();
    return;
  }

  const provided = req.get("x-api-key") || req.query.api_key;

  if (provided !== expected) {
    res.status(401).json({ error: "invalid api key" });
    return;
  }

  next();
}

app.get("/", (_req, res) => {
  const posts = getAllArticles();

  res.render("index", {
    pageTitle: siteConfig.siteName,
    pageDescription: siteConfig.siteDescription,
    siteConfig,
    posts,
    formatDate,
    pageHeader: "最新收藏",
    emptyMessage: "还没有文章，先上传第一篇吧。",
    activeNav: "home"
  });
});

app.get("/categories/", (_req, res) => {
  res.render("taxonomy", {
    pageTitle: `分类 | ${siteConfig.siteName}`,
    pageDescription: "按分类浏览文章",
    siteConfig,
    heading: "分类",
    terms: getAllCategories(),
    basePath: "/categories/",
    activeNav: "categories"
  });
});

app.get("/categories/:slug/", (req, res) => {
  const category = getCategoryBySlug(req.params.slug);

  if (!category) {
    res.status(404).render("not-found", {
      pageTitle: "404 | Not Found",
      pageDescription: "分类不存在",
      siteConfig,
      activeNav: "categories"
    });
    return;
  }

  res.render("index", {
    pageTitle: `${category.name} | 分类 | ${siteConfig.siteName}`,
    pageDescription: `分类 ${category.name} 下的文章`,
    siteConfig,
    posts: category.posts,
    formatDate,
    pageHeader: `分类：${category.name}`,
    emptyMessage: "这个分类暂时没有文章。",
    activeNav: "categories"
  });
});

app.get("/tags/", (_req, res) => {
  res.render("taxonomy", {
    pageTitle: `标签 | ${siteConfig.siteName}`,
    pageDescription: "按标签浏览文章",
    siteConfig,
    heading: "标签",
    terms: getAllTags(),
    basePath: "/tags/",
    activeNav: "tags"
  });
});

app.get("/tags/:slug/", (req, res) => {
  const tag = getTagBySlug(req.params.slug);

  if (!tag) {
    res.status(404).render("not-found", {
      pageTitle: "404 | Not Found",
      pageDescription: "标签不存在",
      siteConfig,
      activeNav: "tags"
    });
    return;
  }

  res.render("index", {
    pageTitle: `${tag.name} | 标签 | ${siteConfig.siteName}`,
    pageDescription: `标签 ${tag.name} 下的文章`,
    siteConfig,
    posts: tag.posts,
    formatDate,
    pageHeader: `标签：${tag.name}`,
    emptyMessage: "这个标签暂时没有文章。",
    activeNav: "tags"
  });
});

app.get("/search/", (req, res) => {
  const query = String(req.query.q || "").trim();
  const results = query ? searchArticles(query) : [];

  res.render("search", {
    pageTitle: `搜索 | ${siteConfig.siteName}`,
    pageDescription: "站内文章搜索",
    siteConfig,
    query,
    results,
    formatDate,
    activeNav: "search"
  });
});

app.get("/posts/:slug/", (req, res) => {
  const post = readArticleBySlug(req.params.slug);

  if (!post) {
    res.status(404).render("not-found", {
      pageTitle: "404 | Not Found",
      pageDescription: "文章不存在",
      siteConfig,
      activeNav: "home"
    });
    return;
  }

  const neighbors = getNeighborArticles(req.params.slug);

  res.render("post", {
    pageTitle: `${post.title} | ${siteConfig.siteName}`,
    pageDescription: post.summary,
    siteConfig,
    post,
    formatDate,
    prev: neighbors.prev,
    next: neighbors.next,
    activeNav: "home"
  });
});

app.get("/api/v1/health", (_req, res) => {
  res.json({ ok: true, service: "wikiblog-prototype" });
});

app.get("/api/v1/search", (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    res.json({ items: [] });
    return;
  }

  const items = searchArticles(query).map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    author: item.author,
    tags: item.tags,
    categories: item.categories,
    publishedAt: item.publishedAt,
    url: `/posts/${item.slug}/`
  }));

  res.json({ items });
});

app.get("/api/v1/articles", (_req, res) => {
  const articles = getAllArticles().map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    author: item.author,
    tags: item.tags,
    categories: item.categories,
    publishedAt: item.publishedAt,
    readingTimeMinutes: item.readingTimeMinutes,
    wordCount: item.wordCount,
    listCoverImage: item.listCoverImage,
    coverImage: item.coverImage,
    source: item.source,
    language: item.language,
    url: `/posts/${item.slug}/`
  }));

  res.json({ items: articles });
});

app.get("/api/v1/articles/:slug", (req, res) => {
  const article = readArticleBySlug(req.params.slug);

  if (!article) {
    res.status(404).json({ error: "article not found" });
    return;
  }

  res.json({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    author: article.author,
    tags: article.tags,
    categories: article.categories,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    wordCount: article.wordCount,
    listCoverImage: article.listCoverImage,
    coverImage: article.coverImage,
    source: article.source,
    language: article.language,
    contentMarkdown: article.contentMarkdown,
    url: `/posts/${article.slug}/`
  });
});

app.post("/api/v1/articles", requireApiKey, (req, res) => {
  try {
    const article = saveArticle(req.body);

    res.status(201).json({
      ok: true,
      slug: article.slug,
      url: `/posts/${article.slug}/`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use((_req, res) => {
  res.status(404).render("not-found", {
    pageTitle: "404 | Not Found",
    pageDescription: "页面不存在",
    siteConfig,
    activeNav: "home"
  });
});

app.listen(port, () => {
  console.log(`WikiBlog prototype is running at http://localhost:${port}`);
});
