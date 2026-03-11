const path = require("node:path");

const siteConfig = {
  siteName: process.env.SITE_NAME || "OpenClaw Reading",
  siteDescription:
    process.env.SITE_DESCRIPTION ||
    "AI 驱动的个人文章收藏站，统一沉淀来自公众号、X 和技术博客的高质量内容。",
  ownerName: process.env.SITE_OWNER || "Ella",
  locale: "zh-CN",
  social: {
    x: process.env.SOCIAL_X || "https://x.com/",
    github: process.env.SOCIAL_GITHUB || "https://github.com/"
  }
};

const obsidianVaultPath =
  process.env.OBSIDIAN_VAULT_PATH || "/Users/ellachan/Documents/Obsidian/cc/知识库";

const storageConfig = {
  obsidianVaultPath,
  obsidianRootPath:
    process.env.OBSIDIAN_ROOT_PATH || path.dirname(obsidianVaultPath),
  localPostsPath: path.join(process.cwd(), "content", "posts")
};

module.exports = { siteConfig, storageConfig };
