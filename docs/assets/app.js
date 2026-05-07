(function () {
  "use strict";

  // --- State ---
  var data = null;
  var currentPeriod = "daily";
  var currentSort = "by_views";

  // --- DOM refs ---
  var lastUpdatedEl = document.getElementById("last-updated");
  var periodTabsEl = document.getElementById("period-tabs");
  var sortSelectEl = document.getElementById("sort-select");
  var tweetListEl = document.getElementById("tweet-list");
  var loadingStateEl = document.getElementById("loading-state");
  var errorStateEl = document.getElementById("error-state");
  var errorMessageEl = document.getElementById("error-message");
  var statsLineEl = document.getElementById("stats-line");

  // --- Helpers ---

  function formatNumber(n) {
    if (n == null) return "0";
    n = Number(n);
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return String(n);
  }

  function truncateText(text, maxLen) {
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "...";
  }

  function toJSTString(isoString) {
    if (!isoString) return "不明";
    try {
      var d = new Date(isoString);
      return d.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " JST";
    } catch (e) {
      return isoString;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Period label map ---
  var periodLabels = {
    daily: "直近1日",
    weekly: "直近7日",
    monthly: "直近30日",
  };

  // --- Rendering ---

  function getRankings() {
    if (!data || !data.rankings) return [];
    var periodData = data.rankings[currentPeriod];
    if (!periodData) return [];
    var sorted = periodData[currentSort];
    if (!sorted) {
      // Fallback: try first available sort key
      var keys = Object.keys(periodData);
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(periodData[keys[i]])) return periodData[keys[i]];
      }
      return [];
    }
    return sorted;
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return "";
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function renderTweetCard(tweet, rank) {
    var author = tweet.author || {};
    var metrics = tweet.metrics || {};
    var media = tweet.media || {};
    var handle = author.userName ? "@" + escapeHtml(author.userName) : "@unknown";
    var displayName = escapeHtml(author.name || author.userName || "");
    var verified = author.isBlueVerified
      ? '<svg class="inline w-4 h-4 ml-1 text-xblue" viewBox="0 0 22 22" fill="currentColor"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.26.276 1.897.143.634-.131 1.218-.437 1.687-.883.445-.468.751-1.053.882-1.687.13-.634.083-1.293-.14-1.9.587-.272 1.084-.702 1.438-1.241.355-.54.553-1.169.57-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>'
      : "";
    var tweetUrl = tweet.url || "https://x.com";
    var tweetText = truncateText(tweet.text, 80);

    // Aspect ratio for media container (default 16:9)
    var aspect = "56.25%";
    if (Array.isArray(media.aspectRatio) && media.aspectRatio.length === 2 && media.aspectRatio[0] > 0) {
      aspect = (media.aspectRatio[1] / media.aspectRatio[0] * 100).toFixed(2) + "%";
    }

    var mediaBlock = "";
    if (media.thumbnailUrl) {
      var duration = formatDuration(media.durationMs);
      var videoUrl = media.videoUrl ? escapeHtml(media.videoUrl) : "";
      var thumbUrl = escapeHtml(media.thumbnailUrl);
      var posterAttr = videoUrl
        ? ' data-video="' + videoUrl + '" data-poster="' + thumbUrl + '"'
        : "";
      mediaBlock =
        '<div class="media-container relative mt-3 rounded-lg overflow-hidden bg-black"' + posterAttr + ' style="padding-bottom:' + aspect + ';">' +
          '<img src="' + thumbUrl + '" loading="lazy" alt="" class="absolute inset-0 w-full h-full object-cover" />' +
          (videoUrl
            ? '<button type="button" class="play-btn absolute inset-0 flex items-center justify-center group" aria-label="再生">' +
                '<span class="w-14 h-14 rounded-full bg-black/60 group-hover:bg-xblue/90 flex items-center justify-center transition-colors">' +
                  '<svg class="w-6 h-6 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                "</span>" +
              "</button>"
            : "") +
          (duration
            ? '<span class="absolute bottom-2 right-2 px-1.5 py-0.5 text-xs text-white bg-black/70 rounded">' + duration + "</span>"
            : "") +
        "</div>";
    }

    return (
      '<div class="tweet-card block rounded-xl border border-gray-200 dark:border-gray-700 p-4">' +
        '<div class="flex items-start gap-3">' +
          // Rank
          '<div class="flex-shrink-0 w-8 h-8 rounded-full bg-xblue/10 dark:bg-xblue/20 flex items-center justify-center">' +
            '<span class="text-xblue font-bold text-sm">' + rank + "</span>" +
          "</div>" +
          // Content
          '<div class="flex-1 min-w-0">' +
            // Header link (clickable to X)
            '<a href="' + escapeHtml(tweetUrl) + '" target="_blank" rel="noopener noreferrer" class="block hover:opacity-90">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span class="font-semibold text-sm truncate">' + displayName + verified + "</span>" +
                '<span class="text-gray-400 dark:text-gray-500 text-sm truncate">' + handle + "</span>" +
              "</div>" +
              '<div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">' +
                '<span class="font-medium text-gray-700 dark:text-gray-200">👁 ' + formatNumber(metrics.viewCount) + " views</span>" +
                '<span>🔖 ' + formatNumber(metrics.bookmarkCount) + " saves</span>" +
              "</div>" +
              '<p class="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-snug">' + escapeHtml(tweetText) + "</p>" +
            "</a>" +
            // Media (interactive, not inside <a>)
            mediaBlock +
            // Metrics bar
            '<div class="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">' +
              "<span>❤ " + formatNumber(metrics.likeCount) + "</span>" +
              '<span>🔁 ' + formatNumber(metrics.retweetCount) + "</span>" +
              '<span>💬 ' + formatNumber(metrics.replyCount) + "</span>" +
              '<span>🔖 ' + formatNumber(metrics.bookmarkCount) + "</span>" +
              '<a href="' + escapeHtml(tweetUrl) + '" target="_blank" rel="noopener noreferrer" class="ml-auto text-xblue opacity-70 hover:opacity-100">Xで開く ↗</a>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var rankings = getRankings();

    // Stats line
    var periodLabel = periodLabels[currentPeriod] || currentPeriod;
    statsLineEl.textContent = periodLabel + " - " + rankings.length + "件のツイート";

    // Clear existing tweet cards (keep loading/error states)
    var cards = tweetListEl.querySelectorAll(".tweet-card");
    for (var i = 0; i < cards.length; i++) {
      cards[i].remove();
    }

    if (rankings.length === 0) {
      var empty = document.createElement("div");
      empty.className = "tweet-card text-center py-16 text-gray-400 dark:text-gray-500";
      empty.textContent = "該当するデータがありません";
      tweetListEl.appendChild(empty);
      return;
    }

    var fragment = document.createDocumentFragment();
    for (var j = 0; j < rankings.length; j++) {
      var wrapper = document.createElement("div");
      wrapper.innerHTML = renderTweetCard(rankings[j], j + 1);
      fragment.appendChild(wrapper.firstChild);
    }
    tweetListEl.appendChild(fragment);
  }

  // --- Tab switching ---

  function setActiveTab(period) {
    currentPeriod = period;
    var buttons = periodTabsEl.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (btn.dataset.period === period) {
        btn.className = "tab-active px-4 py-2 rounded-full text-sm font-medium border border-xblue transition-colors";
      } else {
        btn.className = "px-4 py-2 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-xblue hover:text-xblue transition-colors";
      }
    }
    render();
  }

  // Inline video playback on play button click
  tweetListEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".play-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var container = btn.closest(".media-container");
    if (!container) return;
    var videoUrl = container.getAttribute("data-video");
    var posterUrl = container.getAttribute("data-poster");
    if (!videoUrl) return;

    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    if (posterUrl) video.poster = posterUrl;
    video.className = "absolute inset-0 w-full h-full bg-black";
    container.innerHTML = "";
    container.appendChild(video);
  });

  periodTabsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-period]");
    if (!btn) return;
    setActiveTab(btn.dataset.period);
  });

  sortSelectEl.addEventListener("change", function () {
    currentSort = sortSelectEl.value;
    render();
  });

  // --- Show/hide states ---

  function showLoading() {
    loadingStateEl.classList.remove("hidden");
    errorStateEl.classList.add("hidden");
  }

  function showError(msg) {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.remove("hidden");
    errorMessageEl.textContent = msg || "";
  }

  function showContent() {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.add("hidden");
  }

  // --- Init ---

  function init() {
    showLoading();

    fetch("data.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        data = json;

        // Populate last updated
        var generatedAt = json.generated_at || json.generatedAt || json.fetched_at;
        lastUpdatedEl.textContent = "Last updated: " + toJSTString(generatedAt);

        showContent();
        render();
      })
      .catch(function (err) {
        console.error("Failed to load data.json:", err);
        showError(err.message);
      });
  }

  init();
})();
