const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const slugify = require("slugify");
const { marked } = require("marked");
const { storageConfig } = require("../config");

const POSTS_DIR = storageConfig.localPostsPath;
const OBSIDIAN_VAULT_DIR = storageConfig.obsidianVaultPath;
const OBSIDIAN_ROOT_DIR = storageConfig.obsidianRootPath;
const EMOJI_REGEX = /[\p{Extended_Pictographic}]/u;
const EMOJI_GLOBAL_REGEX = /[\p{Extended_Pictographic}]/gu;
const THEME_IMAGE_POOLS = {
  ai: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&q=80"
  ],
  business: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1444653389962-8149286c578a?auto=format&fit=crop&w=1600&q=80"
  ],
  notes: [
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=80"
  ],
  thinking: [
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1600&q=80"
  ],
  default: [
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1484417894907-623942c8ee29?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=1600&q=80"
  ]
};
const THEME_MATCHERS = [
  {
    theme: "ai",
    regexes: [/ai-agent/i, /\bai\b/i, /agent/i, /prompt/i, /自动化/, /工作流/, /模型/, /llm/, /claude/i, /n8n/i]
  },
  {
    theme: "business",
    regexes: [/搞钱/, /创业/, /赚钱/, /商业/, /副业/, /business/i, /money/i, /openclaw/i, /skills?/i]
  },
  {
    theme: "notes",
    regexes: [/笔记/, /知识管理/, /第二大脑/, /学习/, /写作/, /note/i, /knowledge/i, /brain/i]
  },
  {
    theme: "thinking",
    regexes: [/思维/, /工具/, /方法论/, /认知/, /mind/i, /thinking/i, /framework/i]
  }
];

function ensurePostsDir() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateWordCount(text) {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (text.replace(/[\u4e00-\u9fff]/g, "").match(/[A-Za-z0-9_]+/g) || [])
    .length;
  return cjk + latin;
}

function estimateReadingTime(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 300));
}

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function inferTheme(articleInput) {
  const categories = normalizeStringArray(
    articleInput.categories || articleInput.category
  ).map((item) => item.toLowerCase());

  if (categories.some((name) => name.includes("搞钱") || name.includes("创业"))) {
    return "business";
  }
  if (categories.some((name) => name.includes("笔记"))) {
    return "notes";
  }
  if (categories.some((name) => name.includes("思维") || name.includes("工具"))) {
    return "thinking";
  }
  if (categories.some((name) => name.includes("ai-agent") || name.includes("agent"))) {
    return "ai";
  }

  const haystack = [
    articleInput.title || "",
    categories.join(" "),
    normalizeStringArray(articleInput.tags).join(" "),
    articleInput.summary || "",
    articleInput.contentMarkdown || ""
  ]
    .join(" ")
    .toLowerCase();

  const matched = THEME_MATCHERS.find((rule) =>
    rule.regexes.some((regex) => regex.test(haystack))
  );

  return matched ? matched.theme : "default";
}

function pickThematicListCover(articleInput) {
  const theme = inferTheme(articleInput);
  const pool = THEME_IMAGE_POOLS[theme] || THEME_IMAGE_POOLS.default;
  const seed = `${articleInput.slug || articleInput.title || theme}-${theme}`;
  const numericHash = parseInt(hashString(seed), 36);
  const index = Number.isNaN(numericHash) ? 0 : numericHash % pool.length;

  return pool[index];
}

function sanitizeUnicodeSlug(input) {
  return String(input || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(EMOJI_GLOBAL_REGEX, "")
    .replace(/\s+/g, "-")
    .replace(/[/?#%\\]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function termSlugFromName(name) {
  const normalized = slugify(name || "", {
    lower: true,
    strict: true,
    trim: true
  });

  if (normalized) {
    return normalized;
  }

  const unicodeSafe = sanitizeUnicodeSlug(name);
  if (unicodeSafe) {
    return unicodeSafe;
  }

  return `term-${hashString(String(name || "term"))}`;
}

function createSafeSlug(input) {
  const normalized = slugify(input || "", {
    lower: true,
    strict: true,
    trim: true
  });

  if (normalized) {
    return normalized;
  }

  const unicodeSafe = sanitizeUnicodeSlug(input);
  if (unicodeSafe) {
    return unicodeSafe;
  }

  return `post-${Date.now()}`;
}

function createUniqueSlug(baseSlug) {
  let candidate = baseSlug;
  let index = 2;

  while (fs.existsSync(path.join(POSTS_DIR, `${candidate}.md`))) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }

  return candidate;
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function normalizeStringArray(input) {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  });

  return output;
}

function buildTermRefs(values) {
  return values.map((name) => ({
    name,
    slug: termSlugFromName(name)
  }));
}

function createHeadingIdGenerator() {
  const seen = new Map();

  return function headingId(text) {
    const raw = text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .trim()
      .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
      .replace(/\s+/g, "-") || "section";

    const count = seen.get(raw) || 0;
    seen.set(raw, count + 1);

    if (count === 0) {
      return raw;
    }

    return `${raw}-${count + 1}`;
  };
}

function renderMarkdownWithToc(markdown) {
  const toc = [];
  const headingId = createHeadingIdGenerator();
  const renderer = new marked.Renderer();

  renderer.heading = (token) => {
    const inline = marked.Parser.parseInline(token.tokens);
    const id = headingId(token.text);

    if (token.depth >= 2 && token.depth <= 3) {
      toc.push({
        id,
        text: token.text,
        depth: token.depth
      });
    }

    return `<h${token.depth} id="${id}">${inline}<a hidden class="anchor" aria-hidden="true" href="#${id}">#</a></h${token.depth}>`;
  };

  const html = marked.parse(markdown, {
    gfm: true,
    breaks: false,
    renderer
  });

  return { html, toc };
}

function buildArticleRecord(input) {
  const contentMarkdown = (input.contentMarkdown || "").trim();
  const plain = stripMarkdown(contentMarkdown);
  const wordCount = input.wordCount || estimateWordCount(plain);
  const tags = dedupeStrings(normalizeStringArray(input.tags));
  const categories = dedupeStrings(
    normalizeStringArray(input.categories || input.category)
  );
  const { html, toc } = renderMarkdownWithToc(contentMarkdown);
  const listCoverImage = input.listCoverImage || pickThematicListCover(input);

  return {
    slug: input.slug,
    title: input.title || "Untitled",
    summary: (input.summary || plain.slice(0, 140)).trim(),
    author: (input.author || "爱吃鱼的龙虾哥").trim(),
    tags,
    tagRefs: buildTermRefs(tags),
    categories,
    categoryRefs: buildTermRefs(categories),
    publishedAt: normalizeDate(input.publishedAt),
    readingTimeMinutes:
      input.readingTimeMinutes || estimateReadingTime(wordCount),
    wordCount,
    listCoverImage,
    coverImage: input.coverImage || "",
    source: input.source || null,
    language: input.language || "zh",
    contentMarkdown,
    contentHtml: html,
    toc
  };
}

function listLocalMarkdownFiles() {
  ensurePostsDir();
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(POSTS_DIR, file));
}

function parseLocalMarkdownFile(filePath) {
  const slug = path.basename(filePath).replace(/\.md$/, "");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);

  return buildArticleRecord({
    slug,
    title: parsed.data.title,
    summary: parsed.data.summary,
    author: parsed.data.author,
    tags: parsed.data.tags,
    categories: parsed.data.categories || parsed.data.category,
    publishedAt: parsed.data.publishedAt,
    readingTimeMinutes: parsed.data.readingTimeMinutes,
    wordCount: parsed.data.wordCount,
    listCoverImage: parsed.data.listCoverImage,
    coverImage: parsed.data.coverImage,
    source: parsed.data.source,
    language: parsed.data.language,
    contentMarkdown: parsed.content
  });
}

function collectMarkdownFilesRecursively(dirPath, acc) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      collectMarkdownFilesRecursively(fullPath, acc);
      return;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      acc.push(fullPath);
    }
  });
}

function listObsidianMarkdownFiles() {
  if (!fs.existsSync(OBSIDIAN_VAULT_DIR)) {
    return [];
  }

  const rootEntries = fs.readdirSync(OBSIDIAN_VAULT_DIR, { withFileTypes: true });
  const markdownFiles = [];

  rootEntries
    .filter((entry) => entry.isDirectory() && EMOJI_REGEX.test(entry.name))
    .forEach((entry) => {
      collectMarkdownFilesRecursively(
        path.join(OBSIDIAN_VAULT_DIR, entry.name),
        markdownFiles
      );
    });

  return markdownFiles;
}

function extractMetaLine(raw, label) {
  const key = `**${label}**:`;
  const line = raw.split(/\r?\n/).find((item) => item.includes(key));

  if (!line) {
    return "";
  }

  return line.slice(line.indexOf(key) + key.length).trim();
}

function extractHashTags(line) {
  const matches = [];
  const regex = /#([^\s#]+)/g;
  let match = regex.exec(line || "");

  while (match) {
    matches.push(match[1]);
    match = regex.exec(line || "");
  }

  return dedupeStrings(matches);
}

function parseSourceMeta(sourceLine) {
  if (!sourceLine) {
    return null;
  }

  const markdownLink = sourceLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (markdownLink) {
    return {
      platform: "external",
      name: markdownLink[1].trim(),
      url: markdownLink[2].trim()
    };
  }

  const urlMatch = sourceLine.match(/https?:\/\/\S+/);
  if (urlMatch) {
    return {
      platform: "external",
      name: "原文链接",
      url: urlMatch[0]
    };
  }

  return null;
}

function cleanupCategoryName(folderName) {
  return String(folderName || "")
    .replace(EMOJI_GLOBAL_REGEX, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[-_\s]+|[-_\s]+$/g, "");
}

function buildObsidianSlug(filePath) {
  const relative = path
    .relative(OBSIDIAN_VAULT_DIR, filePath)
    .replace(/\.md$/i, "")
    .split(path.sep)
    .map((part) => part.replace(EMOJI_GLOBAL_REGEX, "").trim())
    .filter(Boolean)
    .join("-");

  const normalized = slugify(relative, {
    lower: true,
    strict: true,
    trim: true
  });

  if (normalized) {
    return normalized;
  }

  const unicodeSafe = sanitizeUnicodeSlug(relative);
  if (unicodeSafe) {
    return unicodeSafe;
  }

  return `obsidian-${hashString(relative || filePath)}`;
}

function stripLeadingObsidianMetadata(raw) {
  const lines = raw.split(/\r?\n/);
  let cursor = 0;

  while (cursor < lines.length && lines[cursor].trim() === "") {
    cursor += 1;
  }

  if (cursor < lines.length && /^#\s+/.test(lines[cursor])) {
    cursor += 1;
  }

  while (cursor < lines.length && lines[cursor].trim() === "") {
    cursor += 1;
  }

  let scan = cursor;
  let sawMeta = false;

  while (scan < lines.length && scan - cursor < 40) {
    const text = lines[scan].trim();

    if (!text) {
      scan += 1;
      continue;
    }

    if (text === "---") {
      if (sawMeta) {
        cursor = scan + 1;
      }
      break;
    }

    if (text.includes("**") && text.includes(":")) {
      sawMeta = true;
      scan += 1;
      continue;
    }

    break;
  }

  while (cursor < lines.length && lines[cursor].trim() === "") {
    cursor += 1;
  }

  return lines.slice(cursor).join("\n").trim();
}

function rewriteObsidianRelativeLinks(markdown, filePath) {
  return markdown.replace(/(!?\[[^\]]*\])\(([^)\n]+)\)/g, (full, label, target) => {
    const cleaned = String(target || "").trim();

    if (!cleaned || /^(https?:|data:|mailto:|#|\/)/i.test(cleaned)) {
      return full;
    }

    const absolutePath = path.resolve(path.dirname(filePath), cleaned);
    if (!absolutePath.startsWith(OBSIDIAN_ROOT_DIR)) {
      return full;
    }

    const relativePath = path
      .relative(OBSIDIAN_ROOT_DIR, absolutePath)
      .split(path.sep)
      .join("/");

    return `${label}(/obsidian-files/${encodeURI(relativePath)})`;
  });
}

function parseObsidianMarkdownFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const stats = fs.statSync(filePath);
  const relativePath = path.relative(OBSIDIAN_VAULT_DIR, filePath);
  const folderName = relativePath.split(path.sep)[0] || "知识库";
  const category = cleanupCategoryName(folderName) || "知识库";
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title =
    (titleMatch && titleMatch[1].trim()) ||
    path.basename(filePath).replace(/\.md$/, "").trim();

  const authorLine = extractMetaLine(raw, "作者");
  const dateLine = extractMetaLine(raw, "整理日期");
  const tagsLine = extractMetaLine(raw, "标签");
  const sourceLine = extractMetaLine(raw, "来源");

  const dateMatch = (dateLine || "").match(/\d{4}-\d{2}-\d{2}/);
  const body = rewriteObsidianRelativeLinks(
    stripLeadingObsidianMetadata(raw),
    filePath
  );
  const firstImage = body.match(/!\[[^\]]*\]\(([^)\n]+)\)/);
  const plain = stripMarkdown(body);

  return buildArticleRecord({
    slug: buildObsidianSlug(filePath),
    title,
    summary: plain.slice(0, 140),
    author: authorLine || "爱吃鱼的龙虾哥",
    tags: extractHashTags(tagsLine),
    categories: [category],
    publishedAt: dateMatch ? `${dateMatch[0]}T00:00:00+08:00` : stats.mtime.toISOString(),
    coverImage: firstImage ? firstImage[1] : "",
    source: parseSourceMeta(sourceLine),
    language: "zh",
    contentMarkdown: body
  });
}

function ensureUniqueSlugs(articles) {
  const seen = new Map();

  return articles.map((article) => {
    const counter = seen.get(article.slug) || 0;
    seen.set(article.slug, counter + 1);

    if (counter === 0) {
      return article;
    }

    return {
      ...article,
      slug: `${article.slug}-${counter + 1}`
    };
  });
}

function getAllArticles() {
  const local = listLocalMarkdownFiles().map((filePath) => parseLocalMarkdownFile(filePath));
  const obsidian = listObsidianMarkdownFiles().map((filePath) =>
    parseObsidianMarkdownFile(filePath)
  );

  return ensureUniqueSlugs([...local, ...obsidian]).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function readArticleBySlug(slug) {
  return getAllArticles().find((article) => article.slug === slug) || null;
}

function getNeighborArticles(slug) {
  const all = getAllArticles();
  const index = all.findIndex((item) => item.slug === slug);

  if (index < 0) {
    return { prev: null, next: null };
  }

  return {
    prev: all[index + 1] || null,
    next: all[index - 1] || null
  };
}

function buildTaxonomy(fieldName) {
  const termMap = new Map();
  const articles = getAllArticles();

  articles.forEach((article) => {
    const seenInPost = new Set();

    article[fieldName].forEach((name) => {
      const slug = termSlugFromName(name);

      if (seenInPost.has(slug)) {
        return;
      }
      seenInPost.add(slug);

      if (!termMap.has(slug)) {
        termMap.set(slug, {
          slug,
          name,
          count: 0,
          posts: []
        });
      }

      const term = termMap.get(slug);
      term.count += 1;
      term.posts.push(article);
    });
  });

  return Array.from(termMap.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hans-CN")
  );
}

function getAllTags() {
  return buildTaxonomy("tags").map((item) => ({
    slug: item.slug,
    name: item.name,
    count: item.count
  }));
}

function getAllCategories() {
  return buildTaxonomy("categories").map((item) => ({
    slug: item.slug,
    name: item.name,
    count: item.count
  }));
}

function getTagBySlug(slug) {
  return buildTaxonomy("tags").find((item) => item.slug === slug) || null;
}

function getCategoryBySlug(slug) {
  return buildTaxonomy("categories").find((item) => item.slug === slug) || null;
}

function searchArticles(query) {
  const normalized = String(query || "").trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return getAllArticles().filter((article) => {
    const haystack = [
      article.title,
      article.summary,
      article.author,
      article.tags.join(" "),
      article.categories.join(" "),
      article.contentMarkdown,
      article.source?.name || "",
      article.source?.platform || ""
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

function normalizePayload(payload) {
  const title = (payload.title || "").trim();
  const contentMarkdown = (payload.contentMarkdown || "").trim();

  if (!title) {
    throw new Error("title is required");
  }

  if (!contentMarkdown) {
    throw new Error("contentMarkdown is required");
  }

  const plainText = stripMarkdown(contentMarkdown);
  const wordCount = payload.wordCount || estimateWordCount(plainText);

  return {
    slug: payload.slug ? createSafeSlug(payload.slug) : createSafeSlug(title),
    title,
    summary: (payload.summary || plainText.slice(0, 140)).trim(),
    author: (payload.author || "爱吃鱼的龙虾哥").trim(),
    tags: dedupeStrings(normalizeStringArray(payload.tags)),
    categories: dedupeStrings(
      normalizeStringArray(payload.categories || payload.category)
    ),
    publishedAt: normalizeDate(payload.publishedAt),
    readingTimeMinutes:
      payload.readingTimeMinutes || estimateReadingTime(wordCount),
    wordCount,
    listCoverImage: (payload.listCoverImage || "").trim(),
    coverImage: (payload.coverImage || "").trim(),
    source: payload.source
      ? {
          platform: (payload.source.platform || "other").trim(),
          name: (payload.source.name || "").trim(),
          url: (payload.source.url || "").trim()
        }
      : null,
    language: (payload.language || "zh").trim(),
    contentMarkdown
  };
}

function saveArticle(payload) {
  ensurePostsDir();
  const normalized = normalizePayload(payload);
  const slug = createUniqueSlug(normalized.slug);

  const frontmatter = {
    title: normalized.title,
    summary: normalized.summary,
    author: normalized.author,
    publishedAt: normalized.publishedAt,
    readingTimeMinutes: normalized.readingTimeMinutes,
    wordCount: normalized.wordCount,
    listCoverImage: normalized.listCoverImage,
    coverImage: normalized.coverImage,
    tags: normalized.tags,
    categories: normalized.categories,
    source: normalized.source,
    language: normalized.language
  };

  const output = matter.stringify(normalized.contentMarkdown, frontmatter);
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  fs.writeFileSync(filePath, output, "utf8");

  return parseLocalMarkdownFile(filePath);
}

module.exports = {
  getAllArticles,
  readArticleBySlug,
  getNeighborArticles,
  getAllTags,
  getAllCategories,
  getTagBySlug,
  getCategoryBySlug,
  searchArticles,
  saveArticle,
  termSlugFromName
};
