#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parseArgs(argv) {
  const options = {
    root: "知识库",
    api: "http://172.245.138.116/api/v1/articles",
    limit: 10,
    stateFile: "知识库/.workflow_runs/publish-state.json",
    reportFile: "知识库/.workflow_runs/publish-report.md",
    dryRun: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--root") {
      options.root = argv[index + 1] || options.root;
      index += 1;
      continue;
    }

    if (token === "--api") {
      options.api = argv[index + 1] || options.api;
      index += 1;
      continue;
    }

    if (token === "--limit") {
      options.limit = Number(argv[index + 1] || options.limit);
      index += 1;
      continue;
    }

    if (token === "--state-file") {
      options.stateFile = argv[index + 1] || options.stateFile;
      index += 1;
      continue;
    }

    if (token === "--report-file") {
      options.reportFile = argv[index + 1] || options.reportFile;
      index += 1;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name === "images") {
        continue;
      }
      walk(fullPath, acc);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".md") && !entry.name.startsWith("MOC-")) {
      acc.push(fullPath);
    }
  }

  return acc;
}

function loadState(filePath) {
  if (!fs.existsSync(filePath)) {
    return { publishedFiles: [], publishedSources: [], history: [] };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

function extract(raw, pattern) {
  const match = raw.match(pattern);
  return match ? match[1].trim() : "";
}

function extractSourceUrl(raw) {
  const articleMatch = raw.match(/\[链接\]\((https?:\/\/x\.com\/i\/article\/[^)]+)\)/);
  if (articleMatch) {
    return articleMatch[1].replace(/^http:\/\//i, "https://");
  }

  const externalMatch = raw.match(/\[链接\]\((https?:\/\/[^)]+)\)/);
  if (externalMatch) {
    return externalMatch[1].replace(/^http:\/\//i, "https://");
  }

  const sourceMatch = raw.match(/来源[^\n]*\((https?:\/\/[^)]+)\)/);
  return sourceMatch ? sourceMatch[1].replace(/^http:\/\//i, "https://") : "";
}

function hasBilingualStructure(raw) {
  return raw.includes("## 原文对照") || /\/\s*[^/\n]{2,}/.test(raw);
}

function reviewFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const sourceUrl = extractSourceUrl(raw);
  const title = path.basename(filePath, ".md").replace(/^\d{6}\s+/, "");
  const summary = extract(raw, /(?:- 摘要:|> \*\*导读\*\*:)\s*(.+)/);
  const date = extract(raw, /整理日期[^\d]*(\d{4}-\d{2}-\d{2})/);
  const textOnly = raw
    .replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "")
    .replace(/\[\[([^[\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const issues = [];

  if (!sourceUrl) {
    issues.push("missing source url");
  }

  if (!date) {
    issues.push("missing published date");
  }

  if (summary.length < 36) {
    issues.push("summary too short");
  }

  if (textOnly.length < 1200) {
    issues.push("content too short");
  }

  if ((raw.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length > 8) {
    issues.push("too image heavy");
  }

  if (raw.includes("当前导出只保留标题和预览片段")) {
    issues.push("preview-only note");
  }

  if (raw.includes("当前导出只包含预览态内容")) {
    issues.push("preview-only note");
  }

  const language =
    raw.includes("英文内容") || /^[A-Za-z0-9 ,.'"():;!?-]+$/.test(title) ? "en" : "zh";

  if (language === "en" && !hasBilingualStructure(raw)) {
    issues.push("english note lacks bilingual structure");
  }

  return {
    filePath,
    title,
    date,
    sourceUrl,
    language,
    summary,
    textLength: textOnly.length,
    issues,
    passed: issues.length === 0
  };
}

function sortCandidates(items) {
  return items.sort((left, right) => {
    const dateDelta = String(right.date).localeCompare(String(left.date));
    if (dateDelta !== 0) {
      return dateDelta;
    }

    return right.textLength - left.textLength;
  });
}

function writeReport(filePath, approved, rejected, published) {
  const lines = [
    "# Hourly Publish Report",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    `Approved this run: ${approved.length}`,
    `Rejected this run: ${rejected.length}`,
    `Published this run: ${published.length}`,
    ""
  ];

  if (approved.length > 0) {
    lines.push("## Approved");
    lines.push("");
    for (const item of approved) {
      lines.push(`- ${item.title} | ${item.language} | ${item.sourceUrl}`);
    }
    lines.push("");
  }

  if (rejected.length > 0) {
    lines.push("## Rejected");
    lines.push("");
    for (const item of rejected) {
      lines.push(`- ${item.title} | ${item.issues.join(", ")}`);
    }
    lines.push("");
  }

  if (published.length > 0) {
    lines.push("## Published");
    lines.push("");
    for (const item of published) {
      lines.push(`- ${item.title} -> ${item.slug}`);
    }
    lines.push("");
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function publishBatch(options, approved) {
  const args = ["scripts/publish_knowledge_notes.js", "--api", options.api, "--publish"];

  approved.forEach((item) => {
    args.push("--file", item.filePath);
  });

  const result = spawnSync("node", args, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "publish command failed");
  }

  return JSON.parse(result.stdout);
}

function main() {
  const options = parseArgs(process.argv);
  const state = loadState(options.stateFile);
  const files = walk(options.root);
  const reviewed = files
    .map((filePath) => reviewFile(filePath))
    .filter(
      (item) =>
        !state.publishedFiles.includes(item.filePath) &&
        !state.publishedSources.includes(item.sourceUrl)
    );
  const passed = sortCandidates(reviewed.filter((item) => item.passed)).slice(0, options.limit);
  const rejected = reviewed.filter((item) => !item.passed);

  let published = [];
  if (!options.dryRun && passed.length > 0) {
    const results = publishBatch(options, passed);
    published = results.map((item) => ({
      title: item.title,
      filePath: item.file,
      sourceUrl: item.source,
      slug: item.result ? item.result.slug : ""
    }));

    for (const item of passed) {
      state.publishedFiles.push(item.filePath);
      if (item.sourceUrl) {
        state.publishedSources.push(item.sourceUrl);
      }
    }

    state.history.push({
      runAt: new Date().toISOString(),
      published
    });
    saveState(options.stateFile, state);
  }

  writeReport(options.reportFile, passed, rejected.slice(0, 30), published);

  console.log(
    JSON.stringify(
      {
        approved: passed,
        rejected: rejected.slice(0, 30),
        published,
        stateFile: options.stateFile,
        reportFile: options.reportFile
      },
      null,
      2
    )
  );
}

main();
