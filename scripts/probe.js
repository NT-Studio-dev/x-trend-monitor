// One-off probe to inspect raw API response structure.
// Fetches a single small window and dumps raw JSON so we can see all fields.

const QUERY = "lang:ja filter:videos min_faves:5000 -filter:replies";

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const sinceTime = now - 3600 * 6;
  const untilTime = now - 3600 * 5;

  const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
  url.searchParams.set(
    "query",
    `${QUERY} since_time:${sinceTime} until_time:${untilTime}`,
  );
  url.searchParams.set("queryType", "Latest");

  const res = await fetch(url, {
    headers: { "X-API-Key": process.env.TWITTERAPI_KEY },
  });

  if (!res.ok) {
    console.error("API error:", res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  console.log("=== TOP-LEVEL KEYS ===");
  console.log(Object.keys(data));
  console.log("\n=== TWEET COUNT ===");
  console.log(data.tweets?.length ?? 0);

  if (data.tweets && data.tweets.length > 0) {
    const sample = data.tweets[0];
    console.log("\n=== SAMPLE TWEET KEYS ===");
    console.log(Object.keys(sample));

    console.log("\n=== FULL SAMPLE TWEET (raw) ===");
    console.log(JSON.stringify(sample, null, 2));

    if (data.tweets.length > 1) {
      console.log("\n=== SECOND TWEET (raw) ===");
      console.log(JSON.stringify(data.tweets[1], null, 2));
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
