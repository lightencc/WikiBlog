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
const PRIMARY_NAV_ITEMS = [
  { key: "home", href: "/", label: "最新" },
  { key: "categories", href: "/categories/", label: "分类" },
  { key: "tags", href: "/tags/", label: "标签" },
  { key: "search", href: "/search/", label: "搜索" }
];

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

function buildPrimaryNav(activeNav) {
  return PRIMARY_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: item.key === activeNav
  }));
}

function buildFeaturedTerms(terms, basePath, limit) {
  return terms.slice(0, limit).map((term) => ({
    name: term.name,
    slug: term.slug,
    count: term.count,
    href: `${basePath}${term.slug}/`,
    latestPostTitle: term.latestPostTitle || "",
    latestPublishedAt: term.latestPublishedAt || ""
  }));
}

function getSourcePlatformLabel(source) {
  const platform = String(source?.platform || "").trim().toLowerCase();

  if (platform === "x") {
    return "X";
  }
  if (platform === "wechat") {
    return "公众号";
  }
  if (platform === "newsletter") {
    return "Newsletter";
  }
  if (platform === "blog") {
    return "Blog";
  }
  if (platform === "github") {
    return "GitHub";
  }

  return source?.platform || "原文";
}

function buildSourceCta(source) {
  if (!source?.url) {
    return null;
  }

  return {
    url: source.url,
    label: "去原文深读",
    sourceName: source.name || getSourcePlatformLabel(source),
    platformLabel: getSourcePlatformLabel(source)
  };
}

function buildViewModel({
  activeNav,
  pageKind,
  featuredTags,
  featuredCategories,
  extra = {}
}) {
  return {
    siteConfig,
    pageKind,
    primaryNavItems: buildPrimaryNav(activeNav),
    featuredTags:
      featuredTags || buildFeaturedTerms(getAllTags(), "/tags/", 8),
    featuredCategories:
      featuredCategories || buildFeaturedTerms(getAllCategories(), "/categories/", 4),
    ...extra
  };
}

function renderNotFound(res, activeNav, message) {
  res.status(404).render(
    "not-found",
    buildViewModel({
      activeNav,
      pageKind: "not-found",
      extra: {
        pageTitle: "404 | Not Found",
        pageDescription: message,
        message
      }
    })
  );
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
  const featuredTags = buildFeaturedTerms(getAllTags(), "/tags/", 8);
  const featuredCategories = buildFeaturedTerms(getAllCategories(), "/categories/", 4);

  res.render(
    "index",
    buildViewModel({
      activeNav: "home",
      pageKind: "home",
      featuredTags,
      featuredCategories,
      extra: {
        pageTitle: siteConfig.siteName,
        pageDescription: siteConfig.siteDescription,
        posts,
        formatDate,
        emptyMessage: "还没有文章，先上传第一篇吧。",
        pageIntro: {
          eyebrow: "Reading Recall",
          title: "最新收藏",
          lead: "刷推时顺手收藏，AI 自动整理成可回看的轻笔记。"
        },
        pageSectionTitle: "今天适合回看的内容",
        pageSectionHint: `${posts.length} 篇笔记已整理完成`
      }
    })
  );
});

app.get("/categories/", (_req, res) => {
  const categories = getAllCategories();

  res.render(
    "taxonomy",
    buildViewModel({
      activeNav: "categories",
      pageKind: "taxonomy",
      featuredCategories: buildFeaturedTerms(categories, "/categories/", 4),
      extra: {
        pageTitle: `分类 | ${siteConfig.siteName}`,
        pageDescription: "按分类浏览文章",
        heading: "分类",
        taxonomyKind: "categories",
        terms: categories,
        basePath: "/categories/",
        pageIntro: {
          eyebrow: "Themes",
          title: "按主题回看",
          lead: "用更稳定的主题脉络整理收藏，适合快速重拾某一类输入。"
        }
      }
    })
  );
});

app.get("/categories/:slug/", (req, res) => {
  const category = getCategoryBySlug(req.params.slug);

  if (!category) {
    renderNotFound(res, "categories", "分类不存在");
    return;
  }

  res.render(
    "index",
    buildViewModel({
      activeNav: "categories",
      pageKind: "category-feed",
      extra: {
        pageTitle: `${category.name} | 分类 | ${siteConfig.siteName}`,
        pageDescription: `分类 ${category.name} 下的文章`,
        posts: category.posts,
        formatDate,
        emptyMessage: "这个分类暂时没有文章。",
        pageIntro: {
          eyebrow: "Category",
          title: category.name,
          lead: `这个主题下有 ${category.count} 篇回看笔记，方便你一次重新接上上下文。`
        },
        pageSectionTitle: `${category.name} 的最新笔记`,
        pageSectionHint: `${category.count} 篇`
      }
    })
  );
});

app.get("/tags/", (_req, res) => {
  const tags = getAllTags();

  res.render(
    "taxonomy",
    buildViewModel({
      activeNav: "tags",
      pageKind: "taxonomy",
      featuredTags: buildFeaturedTerms(tags, "/tags/", 8),
      extra: {
        pageTitle: `标签 | ${siteConfig.siteName}`,
        pageDescription: "按标签浏览文章",
        heading: "标签",
        taxonomyKind: "tags",
        terms: tags,
        basePath: "/tags/",
        pageIntro: {
          eyebrow: "Tags",
          title: "按标签切换视角",
          lead: "轻量的标签墙让你快速跳转到某个概念、人物、产品或方法。"
        }
      }
    })
  );
});

app.get("/tags/:slug/", (req, res) => {
  const tag = getTagBySlug(req.params.slug);

  if (!tag) {
    renderNotFound(res, "tags", "标签不存在");
    return;
  }

  res.render(
    "index",
    buildViewModel({
      activeNav: "tags",
      pageKind: "tag-feed",
      extra: {
        pageTitle: `${tag.name} | 标签 | ${siteConfig.siteName}`,
        pageDescription: `标签 ${tag.name} 下的文章`,
        posts: tag.posts,
        formatDate,
        emptyMessage: "这个标签暂时没有文章。",
        pageIntro: {
          eyebrow: "Tag",
          title: `#${tag.name}`,
          lead: `这里收拢了 ${tag.count} 篇和 ${tag.name} 有关的回看摘要。`
        },
        pageSectionTitle: `${tag.name} 标签流`,
        pageSectionHint: `${tag.count} 篇`
      }
    })
  );
});

app.get("/search/", (req, res) => {
  const query = String(req.query.q || "").trim();
  const results = query ? searchArticles(query) : [];

  res.render(
    "search",
    buildViewModel({
      activeNav: "search",
      pageKind: "search",
      extra: {
        pageTitle: `搜索 | ${siteConfig.siteName}`,
        pageDescription: "站内文章搜索",
        query,
        results,
        formatDate,
        pageIntro: {
          eyebrow: "Search",
          title: "搜索回看笔记",
          lead: "按标题、摘要、标签、分类或作者，快速重新找到你曾经划过却还没读完的内容。"
        }
      }
    })
  );
});

app.get("/posts/:slug/", (req, res) => {
  const post = readArticleBySlug(req.params.slug);

  if (!post) {
    renderNotFound(res, "home", "文章不存在");
    return;
  }

  const neighbors = getNeighborArticles(req.params.slug);

  res.render(
    "post",
    buildViewModel({
      activeNav: "home",
      pageKind: "post",
      extra: {
        pageTitle: `${post.title} | ${siteConfig.siteName}`,
        pageDescription: post.summary,
        post,
        formatDate,
        prev: neighbors.prev,
        next: neighbors.next,
        sourceCta: buildSourceCta(post.source)
      }
    })
  );
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
  renderNotFound(res, "home", "页面不存在");
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`WikiBlog prototype is running at http://localhost:${port}`);
  });
}

module.exports = app;
