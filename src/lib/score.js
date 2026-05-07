export function calcEngagementScore(metrics) {
  return (
    (metrics.likeCount ?? 0) * 1 +
    (metrics.retweetCount ?? 0) * 20 +
    (metrics.replyCount ?? 0) * 13.5 +
    (metrics.quoteCount ?? 0) * 13.5 +
    (metrics.bookmarkCount ?? 0) * 10
  );
}
