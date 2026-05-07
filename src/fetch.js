import { searchTweets, retry } from "./lib/api.js";
import { splitDayHourly, subdivideWindow } from "./lib/timewindow.js";
import { calcEngagementScore } from "./lib/score.js";

const QUERY = "lang:ja filter:videos min_faves:5000 -filter:replies";

function extractMedia(raw) {
  const items = raw.extendedEntities?.media ?? [];
  const video = items.find((m) => m.type === "video" || m.type === "animated_gif");
  if (!video) return { type: "video" };

  const variants = video.video_info?.variants ?? [];
  const mp4s = variants
    .filter((v) => v.content_type === "video/mp4" && typeof v.bitrate === "number")
    .sort((a, b) => b.bitrate - a.bitrate);

  return {
    type: video.type,
    thumbnailUrl: video.media_url_https ?? null,
    videoUrl: mp4s[0]?.url ?? null,
    durationMs: video.video_info?.duration_millis ?? null,
    aspectRatio: video.video_info?.aspect_ratio ?? null,
    width: video.original_info?.width ?? null,
    height: video.original_info?.height ?? null,
  };
}

function normalizeTweet(raw) {
  const metrics = {
    viewCount: raw.viewCount ?? 0,
    likeCount: raw.likeCount ?? 0,
    retweetCount: raw.retweetCount ?? 0,
    replyCount: raw.replyCount ?? 0,
    quoteCount: raw.quoteCount ?? 0,
    bookmarkCount: raw.bookmarkCount ?? 0,
  };

  return {
    id: raw.id,
    url: raw.url,
    text: raw.text,
    createdAt: raw.createdAt,
    lang: raw.lang,
    metrics,
    engagementScore: calcEngagementScore(metrics),
    author: {
      userName: raw.author?.userName,
      name: raw.author?.name,
      isBlueVerified: raw.author?.isBlueVerified,
      followersCount: raw.author?.followers ?? 0,
      profileImageUrl: raw.author?.profilePicture ?? null,
    },
    media: extractMedia(raw),
  };
}

async function fetchWindow(window, tweetsMap, stats) {
  let result;
  try {
    result = await retry(
      () =>
        searchTweets({
          query: QUERY,
          sinceTime: window.since,
          untilTime: window.until,
        }),
      3,
    );
    stats.api_calls++;
  } catch (err) {
    console.warn(`[fetch] Failed window ${window.label}: ${err.message}`);
    return;
  }

  for (const raw of result.tweets) {
    tweetsMap.set(raw.id, normalizeTweet(raw));
  }

  if (result.hasMore) {
    const subWindows = subdivideWindow(window);
    if (subWindows) {
      for (const sub of subWindows) {
        await fetchWindow(sub, tweetsMap, stats);
      }
    }
  }
}

export async function fetchDaily(dateStr) {
  const windows = splitDayHourly(dateStr);
  const tweetsMap = new Map();
  const stats = { api_calls: 0 };

  for (const window of windows) {
    await fetchWindow(window, tweetsMap, stats);
  }

  const tweets = Array.from(tweetsMap.values());

  return {
    date: dateStr,
    timezone: "Asia/Tokyo",
    fetched_at: new Date().toISOString(),
    query: {
      text: QUERY,
      type: "Latest",
    },
    stats: {
      total_fetched: stats.api_calls,
      unique_tweets: tweets.length,
      api_calls: stats.api_calls,
    },
    tweets,
  };
}
