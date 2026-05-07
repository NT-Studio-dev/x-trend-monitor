import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const DOCS_DIR = path.resolve("docs");
const TOP_N = 50;

function findLatestFile(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function loadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function labelFromFilename(filePath) {
  if (!filePath) return "";
  return path.basename(filePath, ".json");
}

function buildRankings(tweets) {
  if (!tweets || tweets.length === 0) {
    return { by_views: [], by_bookmarks: [], by_engagement: [] };
  }

  const byViews = [...tweets]
    .sort((a, b) => (b.metrics?.viewCount ?? 0) - (a.metrics?.viewCount ?? 0))
    .slice(0, TOP_N);

  const byBookmarks = [...tweets]
    .sort(
      (a, b) =>
        (b.metrics?.bookmarkCount ?? 0) - (a.metrics?.bookmarkCount ?? 0),
    )
    .slice(0, TOP_N);

  const byEngagement = [...tweets]
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, TOP_N);

  return { by_views: byViews, by_bookmarks: byBookmarks, by_engagement: byEngagement };
}

export function render() {
  const dailyFile = findLatestFile(path.join(DATA_DIR, "daily"));
  const weeklyFile = findLatestFile(path.join(DATA_DIR, "weekly"));
  const monthlyFile = findLatestFile(path.join(DATA_DIR, "monthly"));

  const daily = loadJson(dailyFile);
  const weekly = loadJson(weeklyFile);
  const monthly = loadJson(monthlyFile);

  const dailyTweets = daily?.tweets ?? [];
  const weeklyTweets = weekly?.tweets ?? [];
  const monthlyTweets = monthly?.tweets ?? [];

  const output = {
    generated_at: new Date().toISOString(),
    windows: {
      daily: {
        label: labelFromFilename(dailyFile),
        tweet_count: dailyTweets.length,
      },
      weekly: {
        label: labelFromFilename(weeklyFile),
        tweet_count: weeklyTweets.length,
      },
      monthly: {
        label: labelFromFilename(monthlyFile),
        tweet_count: monthlyTweets.length,
      },
    },
    rankings: {
      daily: buildRankings(dailyTweets),
      weekly: buildRankings(weeklyTweets),
      monthly: buildRankings(monthlyTweets),
    },
  };

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const outPath = path.join(DOCS_DIR, "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`[render] Wrote ${outPath}`);
  return output;
}
