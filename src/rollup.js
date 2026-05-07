import fs from "node:fs";
import path from "node:path";
import {
  startOfISOWeek,
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { calcEngagementScore } from "./lib/score.js";

const DATA_DIR = path.resolve("data");

function readDailyFile(dateStr) {
  const filePath = path.join(DATA_DIR, "daily", `${dateStr}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function mergeTweets(dailyFiles) {
  const tweetsMap = new Map();

  for (const daily of dailyFiles) {
    if (!daily?.tweets) continue;
    for (const tweet of daily.tweets) {
      tweetsMap.set(tweet.id, {
        ...tweet,
        engagementScore: calcEngagementScore(tweet.metrics),
      });
    }
  }

  return Array.from(tweetsMap.values());
}

export function rollupWeekly(referenceDate) {
  const ref = parseISO(referenceDate);
  const weekStart = startOfISOWeek(ref);
  const weekEnd = endOfISOWeek(ref);

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dailyFiles = days
    .map((d) => readDailyFile(format(d, "yyyy-MM-dd")))
    .filter(Boolean);

  const tweets = mergeTweets(dailyFiles);

  const weekYear = getISOWeekYear(ref);
  const weekNum = String(getISOWeek(ref)).padStart(2, "0");
  const label = `${weekYear}-W${weekNum}`;

  const result = {
    period: label,
    type: "weekly",
    generated_at: new Date().toISOString(),
    daily_files_found: dailyFiles.length,
    stats: { unique_tweets: tweets.length },
    tweets,
  };

  const outDir = path.join(DATA_DIR, "weekly");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${label}.json`),
    JSON.stringify(result, null, 2),
  );

  console.log(`[rollup] Weekly ${label}: ${tweets.length} tweets from ${dailyFiles.length} daily files`);
  return result;
}

export function rollupMonthly(referenceDate) {
  const ref = parseISO(referenceDate);
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const dailyFiles = days
    .map((d) => readDailyFile(format(d, "yyyy-MM-dd")))
    .filter(Boolean);

  const tweets = mergeTweets(dailyFiles);

  const label = format(ref, "yyyy-MM");

  const result = {
    period: label,
    type: "monthly",
    generated_at: new Date().toISOString(),
    daily_files_found: dailyFiles.length,
    stats: { unique_tweets: tweets.length },
    tweets,
  };

  const outDir = path.join(DATA_DIR, "monthly");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${label}.json`),
    JSON.stringify(result, null, 2),
  );

  console.log(`[rollup] Monthly ${label}: ${tweets.length} tweets from ${dailyFiles.length} daily files`);
  return result;
}
