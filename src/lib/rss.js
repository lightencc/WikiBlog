const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTag(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(pattern);
  return match ? decodeEntities(match[1]).trim() : "";
}

function extractItems(xml) {
  return String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function summarizeContent(content, fallback, limit = 220) {
  const plain = stripHtml(content || fallback || "");
  if (plain.length <= limit) {
    return plain;
  }
  return `${plain.slice(0, limit).trim()}...`;
}

function parseRssXml(xml, feedConfig) {
  const channelTitle =
    matchTag(xml, "title") || feedConfig.name || "RSS";

  return extractItems(xml)
    .map((itemXml) => {
      const title = matchTag(itemXml, "title");
      const link = matchTag(itemXml, "link");
      const description = matchTag(itemXml, "description");
      const encoded = matchTag(itemXml, "content:encoded");
      const pubDate = matchTag(itemXml, "pubDate");

      if (!title || !link) {
        return null;
      }

      return {
        id: link,
        title,
        url: link,
        feedSlug: feedConfig.slug,
        sourceName: feedConfig.name || channelTitle,
        sourceHome: feedConfig.home || "",
        sourceLabel: feedConfig.label || "RSS",
        publishedAt: normalizeDate(pubDate),
        summary: summarizeContent(encoded, description),
        content: stripHtml(encoded || description),
        feedHref: feedConfig.href
      };
    })
    .filter(Boolean);
}

async function fetchFeedXml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ReadingRecall/1.0 (+rss)"
    }
  });

  if (!response.ok) {
    throw new Error(`rss fetch failed: ${response.status}`);
  }

  return response.text();
}

async function getFeedItems(feedConfig) {
  const cached = cache.get(feedConfig.href);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.items;
  }

  const xml = await fetchFeedXml(feedConfig.href);
  const items = parseRssXml(xml, feedConfig);

  cache.set(feedConfig.href, {
    timestamp: now,
    items
  });

  return items;
}

async function getAggregatedRssFeed(feedConfigs, limit = 24) {
  const settled = await Promise.allSettled(feedConfigs.map((feed) => getFeedItems(feed)));
  const items = [];
  const errors = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      return;
    }

    errors.push({
      feed: feedConfigs[index],
      message: result.reason?.message || "failed to fetch rss"
    });
  });

  items.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return {
    items: items.slice(0, limit),
    errors
  };
}

module.exports = {
  getAggregatedRssFeed
};
