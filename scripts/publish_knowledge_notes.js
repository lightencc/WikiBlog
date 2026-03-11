#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const options = {
    api: "",
    files: [],
    publish: false,
    dryRun: false,
    outDir: ""
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--api") {
      options.api = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (token === "--file") {
      options.files.push(argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (token === "--publish") {
      options.publish = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--out-dir") {
      options.outDir = argv[index + 1] || "";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (options.files.length === 0) {
    throw new Error("At least one --file is required");
  }

  if (options.publish && !options.api) {
    throw new Error("--api is required when --publish is used");
  }

  return options;
}

function stripDatePrefix(name) {
  return name.replace(/^\d{6}\s+/, "").trim();
}

function cleanCategoryName(name) {
  return name.replace(/^\d{2}-/, "").trim();
}

function extractFrontMatterMetadata(raw) {
  const metadata = {};
  const quotePattern = /^>\s+\*\*([^*]+)\*\*:\s*(.+)$/gm;

  let match = quotePattern.exec(raw);
  while (match) {
    metadata[match[1].trim()] = match[2].trim();
    match = quotePattern.exec(raw);
  }

  const infoSectionMatch = raw.match(/## 文章信息\s+([\s\S]*?)(?:\n## |\n# |$)/);
  if (infoSectionMatch) {
    const block = infoSectionMatch[1];
    const linePattern = /^-\s+([^:]+):\s*(.+)$/gm;
    let lineMatch = linePattern.exec(block);
    while (lineMatch) {
      metadata[lineMatch[1].trim()] = lineMatch[2].trim();
      lineMatch = linePattern.exec(block);
    }
  }

  const guideQuote = raw.match(/^>\s+\*\*导读\*\*:\s*(.+)$/m);
  if (guideQuote) {
    metadata.导读 = guideQuote[1].trim();
  }

  return metadata;
}

function getSection(raw, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## ${escaped}\\s+([\\s\\S]*?)(?:\\n## |\\n# |$)`, "m");
  const match = raw.match(pattern);
  return match ? match[1].trim() : "";
}

function extractLinks(raw) {
  const links = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match = pattern.exec(raw);

  while (match) {
    links.push({
      text: match[1].trim(),
      url: match[2].trim().replace(/^http:\/\//i, "https://")
    });
    match = pattern.exec(raw);
  }

  return links;
}

function normalizeTag(value) {
  return value
    .replace(/^#/, "")
    .split("/")
    .pop()
    .trim();
}

function extractTags(metadata) {
  const rawTags = metadata.标签 || "";
  if (!rawTags) {
    return [];
  }

  return Array.from(
    new Set(
      rawTags
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map(normalizeTag)
        .filter(Boolean)
    )
  );
}

function selectSourceUrl(metadata, links) {
  const articleLink = links.find((item) => item.url.includes("x.com/i/article/"));
  if (articleLink) {
    return articleLink.url;
  }

  const externalLink = links.find(
    (item) => !item.url.includes("x.com/") && !item.url.includes("twitter.com/")
  );
  if (externalLink) {
    return externalLink.url;
  }

  const sourceMatch = String(metadata.来源 || "").match(/\((https?:\/\/[^)]+)\)/);
  if (sourceMatch) {
    return sourceMatch[1].replace(/^http:\/\//i, "https://");
  }

  return "";
}

function selectSourceName(metadata) {
  const author = metadata.作者 || "";
  if (author) {
    return author;
  }

  const sourceMatch = String(metadata.来源 || "").match(/\[([^\]]+)\]/);
  if (sourceMatch) {
    return sourceMatch[1].trim();
  }

  return "原始来源";
}

function inferLanguage(metadata, cleanedBody, title) {
  if (String(metadata.形态 || "").includes("英文内容")) {
    return "en";
  }

  if (cleanedBody.includes("## 原文对照")) {
    return "en";
  }

  const sample = `${title}\n${cleanedBody}`.slice(0, 1200);
  const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
  const cjkCount = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  return latinCount > cjkCount ? "en" : "zh";
}

function cleanBody(raw) {
  let output = raw;

  output = output.replace(/^>\s+\*\*[^*]+\*\*:\s*.+$/gm, "");
  output = output.replace(/^---$/gm, "");
  output = output.replace(/^## 文章信息\s+[\s\S]*?(?=\n## |\n# |$)/m, "");
  output = output.replace(/^## 链接\s+[\s\S]*?(?=\n## |\n# |$)/m, "");
  output = output.replace(/^## 关联阅读\s+[\s\S]*?(?=\n## |\n# |$)/m, "");
  output = output.replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "");
  output = output.replace(/\[\[([^[\]]+)\]\]/g, (_full, text) => {
    const parts = String(text).split("/");
    return parts[parts.length - 1];
  });
  output = output.replace(/\n{3,}/g, "\n\n").trim();

  return output;
}

function buildContent(raw, metadata, sourceUrl, title) {
  const guide = metadata.导读 || getSection(raw, "导读");
  const cleanedBody = cleanBody(raw);
  const important = getSection(raw, "读完后记住");
  const language = inferLanguage(metadata, cleanedBody, title);

  const blocks = [];

  if (guide) {
    blocks.push("## 为什么值得收藏");
    blocks.push(guide);
  }

  blocks.push(cleanedBody);

  if (important && !cleanedBody.includes("## 读完后记住")) {
    blocks.push("## 读完后记住");
    blocks.push(important);
  }

  if (sourceUrl) {
    blocks.push("## 来源说明");
    blocks.push(`原文入口：${sourceUrl}`);
  }

  return {
    language,
    contentMarkdown: blocks.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n")
  };
}

function buildPayload(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const metadata = extractFrontMatterMetadata(raw);
  const links = extractLinks(raw);
  const title = stripDatePrefix(path.basename(filePath, ".md"));
  const sourceUrl = selectSourceUrl(metadata, links);
  const sourceName = selectSourceName(metadata);
  const summary =
    metadata.摘要 ||
    metadata.导读 ||
    getSection(raw, "导读") ||
    "整理自知识库笔记，保留原始来源与可追溯入口。";
  const date = metadata.整理日期 ? `${metadata.整理日期}T00:00:00+08:00` : "";
  const folderParts = path.dirname(filePath).split(path.sep).slice(1).map(cleanCategoryName);
  const categories = folderParts.slice(-2).filter(Boolean);
  const tags = extractTags(metadata);
  const { language, contentMarkdown } = buildContent(raw, metadata, sourceUrl, title);

  return {
    title,
    summary: summary.replace(/\s+/g, " ").trim(),
    author: sourceName,
    categories,
    tags,
    publishedAt: date,
    source: sourceUrl
      ? {
          platform: sourceUrl.includes("x.com") ? "x" : "external",
          name: sourceName,
          url: sourceUrl
        }
      : null,
    language,
    contentMarkdown
  };
}

async function publish(api, payload) {
  const response = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const options = parseArgs(process.argv);
  const outputs = [];

  if (options.outDir) {
    fs.mkdirSync(options.outDir, { recursive: true });
  }

  for (const file of options.files) {
    const payload = buildPayload(file);
    const slugBase = path.basename(file, ".md").replace(/^\d{6}\s+/, "");
    const outputName = `${slugBase}.json`.replace(/[\/\\?%*:|"<>]/g, "-");

    if (options.outDir) {
      const outputPath = path.join(options.outDir, outputName);
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
    }

    let result = null;
    if (options.publish && !options.dryRun) {
      result = await publish(options.api, payload);
    }

    outputs.push({
      file,
      title: payload.title,
      language: payload.language,
      source: payload.source ? payload.source.url : "",
      result
    });
  }

  console.log(JSON.stringify(outputs, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
