const RATE_LIMIT_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchTweets({ query, sinceTime, untilTime, queryType = "Latest" }) {
  const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
  url.searchParams.set("query", `${query} since_time:${sinceTime} until_time:${untilTime}`);
  url.searchParams.set("queryType", queryType);

  await sleep(RATE_LIMIT_DELAY_MS);

  const res = await fetch(url, {
    headers: { "X-API-Key": process.env.TWITTERAPI_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    tweets: data.tweets ?? [],
    hasMore: (data.tweets?.length ?? 0) >= 20,
  };
}

export async function retry(fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[retry] attempt ${attempt}/${maxAttempts} failed: ${e.message}, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
