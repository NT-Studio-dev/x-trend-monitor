import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const DOCS_DIR = path.resolve("docs");

// Cap monthly to keep data.json size bounded.
// Daily/weekly are not capped — they are naturally bounded by min_faves filter.
const MONTHLY_CAP = 500;

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

function capByEngagement(tweets, cap) {
  if (!tweets || tweets.length <= cap) return tweets ?? [];
  return [...tweets]
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, cap);
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
  const monthlyTweets = capByEngagement(monthly?.tweets ?? [], MONTHLY_CAP);

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
    tweets: {
      daily: dailyTweets,
      weekly: weeklyTweets,
      monthly: monthlyTweets,
    },
  };

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const outPath = path.join(DOCS_DIR, "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output));

  console.log(
    `[render] Wrote ${outPath} (daily=${dailyTweets.length}, weekly=${weeklyTweets.length}, monthly=${monthlyTweets.length})`,
  );
  return output;
}
