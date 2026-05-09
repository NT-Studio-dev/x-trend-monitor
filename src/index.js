import fs from "node:fs";
import path from "node:path";
import { format, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { fetchDaily } from "./fetch.js";
import { rollupWeekly, rollupMonthly } from "./rollup.js";
import { render } from "./render.js";

const TZ = "Asia/Tokyo";
const DATA_DIR = path.resolve("data");

function getYesterdayJST() {
  const nowJST = toZonedTime(new Date(), TZ);
  const yesterday = subDays(nowJST, 1);
  return format(yesterday, "yyyy-MM-dd");
}

async function main() {
  const dateStr = getYesterdayJST();
  console.log(`[index] Starting pipeline for ${dateStr} (JST)`);

  // Ensure data directories exist
  for (const sub of ["daily", "weekly", "monthly"]) {
    fs.mkdirSync(path.join(DATA_DIR, sub), { recursive: true });
  }

  // 1. Fetch daily tweets
  console.log(`[index] Fetching tweets for ${dateStr}...`);
  const dailyData = await fetchDaily(dateStr);

  // Safety: refuse to overwrite existing data with an empty result.
  // This protects against API outages / credit exhaustion wiping the dashboard.
  const dailyPath = path.join(DATA_DIR, "daily", `${dateStr}.json`);
  if (dailyData.stats.unique_tweets === 0) {
    console.error(
      `[index] Fetched 0 tweets for ${dateStr}. Skipping save/rollup/render to preserve existing data.`,
    );
    if (fs.existsSync(dailyPath)) {
      console.error(`[index] Keeping previous ${dailyPath} intact.`);
    }
    process.exit(1);
  }

  // 2. Save daily file
  fs.writeFileSync(dailyPath, JSON.stringify(dailyData, null, 2));
  console.log(`[index] Saved ${dailyPath} (${dailyData.stats.unique_tweets} tweets)`);

  // 3. Rollup weekly and monthly
  console.log("[index] Running weekly rollup...");
  rollupWeekly(dateStr);

  console.log("[index] Running monthly rollup...");
  rollupMonthly(dateStr);

  // 4. Render dashboard data
  console.log("[index] Rendering dashboard data...");
  render();

  console.log(`[index] Pipeline complete for ${dateStr}`);
}

main().catch((err) => {
  console.error("[index] Fatal error:", err);
  process.exit(1);
});
