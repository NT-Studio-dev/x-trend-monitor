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
    var verified = author.isBlueVerified
      ? '<svg class="inline w-3 h-3 ml-0.5 text-xblue align-middle" viewBox="0 0 22 22" fill="currentColor"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.855-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.26.276 1.897.143.634-.131 1.218-.437 1.687-.883.445-.468.751-1.053.882-1.687.13-.634.083-1.293-.14-1.9.587-.272 1.084-.702 1.438-1.241.355-.54.553-1.169.57-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>'
      : "";
    var tweetUrl = tweet.url || "https://x.com";
    var tweetText = truncateText(tweet.text, 70);

    var thumbUrl = media.thumbnailUrl ? escapeHtml(media.thumbnailUrl) : "";
    var videoUrl = media.videoUrl ? escapeHtml(media.videoUrl) : "";
    var duration = formatDuration(media.durationMs);

    // Primary metric (depends on current sort)
    var primaryMetric, primaryLabel, primaryIcon;
    if (currentSort === "by_bookmarks") {
      primaryMetric = metrics.bookmarkCount; primaryLabel = "saves"; primaryIcon = "🔖";
    } else if (currentSort === "by_engagement") {
      primaryMetric = Math.round(tweet.engagementScore || 0); primaryLabel = "score"; primaryIcon = "🔥";
    } else {
      primaryMetric = metrics.viewCount; primaryLabel = "views"; primaryIcon = "👁";
    }

    var thumbHtml = thumbUrl
      ? '<img src="' + thumbUrl + '" loading="lazy" referrerpolicy="no-referrer" alt="" class="absolute inset-0 w-full h-full object-cover" />'
      : '<div class="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">No preview</div>';

    var playBtnHtml = videoUrl
      ? '<div class="absolute inset-0 flex items-center justify-center pointer-events-none">' +
          '<div class="w-12 h-12 rounded-full bg-black/55 group-hover:bg-xblue/90 flex items-center justify-center transition-colors shadow-lg">' +
            '<svg class="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          "</div>" +
        "</div>"
      : "";

    var durBadge = duration
      ? '<span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[10px] text-white bg-black/75 rounded font-medium">' + duration + "</span>"
      : "";

    var rankBadge =
      '<div class="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center text-xs font-bold backdrop-blur-sm">' +
        rank +
      "</div>";

    var thumbAttrs = videoUrl
      ? ' data-video="' + videoUrl + '" data-poster="' + thumbUrl + '" data-tweet-url="' + escapeHtml(tweetUrl) + '"'
      : ' data-tweet-url="' + escapeHtml(tweetUrl) + '"';

    return (
      '<div class="tweet-card group flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-xdarker hover:border-xblue transition-colors">' +
        // Thumbnail (clickable: video → modal, else → X)
        '<button type="button" class="thumb-btn relative block w-full bg-black aspect-video overflow-hidden"' + thumbAttrs + '>' +
          thumbHtml +
          playBtnHtml +
          rankBadge +
          durBadge +
        "</button>" +
        // Body
        '<div class="flex-1 flex flex-col p-2.5 gap-1.5 min-w-0">' +
          // Author + primary metric
          '<div class="flex items-center justify-between gap-2 min-w-0">' +
            '<a href="' + escapeHtml(tweetUrl) + '" target="_blank" rel="noopener noreferrer" class="text-xs text-gray-500 dark:text-gray-400 truncate hover:text-xblue">' +
              handle + verified +
            "</a>" +
            '<span class="text-xs font-bold text-xblue whitespace-nowrap">' + primaryIcon + " " + formatNumber(primaryMetric) + "</span>" +
          "</div>" +
          // Tweet text
          '<p class="text-xs text-gray-700 dark:text-gray-300 leading-snug line-clamp-2">' + escapeHtml(tweetText) + "</p>" +
          // Secondary metrics
          '<div class="flex items-center gap-2 mt-auto pt-1 text-[10px] text-gray-400 dark:text-gray-500">' +
            "<span>❤ " + formatNumber(metrics.likeCount) + "</span>" +
            '<span>🔁 ' + formatNumber(metrics.retweetCount) + "</span>" +
            '<span>🔖 ' + formatNumber(metrics.bookmarkCount) + "</span>" +
            '<span>👁 ' + formatNumber(metrics.viewCount) + "</span>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var rankings = getRankings();

    var periodLabel = periodLabels[currentPeriod] || currentPeriod;
    statsLineEl.textContent = periodLabel + " - " + rankings.length + "件のツイート";

    tweetListEl.innerHTML = "";

    if (rankings.length === 0) {
      var empty = document.createElement("div");
      empty.className = "col-span-full text-center py-16 text-gray-400 dark:text-gray-500";
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

  // --- Video modal ---
  var modalEl = document.getElementById("video-modal");
  var modalContentEl = document.getElementById("modal-content");
  var modalCloseEl = document.getElementById("modal-close");

  function openVideoModal(videoUrl, posterUrl, tweetUrl) {
    modalContentEl.innerHTML = "";
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;
    video.setAttribute("crossorigin", "anonymous");
    video.referrerPolicy = "no-referrer";
    if (posterUrl) video.poster = posterUrl;
    video.className = "max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-black";

    // If the video fails to load, fall back to opening the tweet on X
    video.addEventListener("error", function () {
      closeModal();
      if (tweetUrl) window.open(tweetUrl, "_blank", "noopener");
    });

    // Try to play; if blocked, retry muted
    video.play().catch(function () {
      video.muted = true;
      video.play().catch(function () {
        // give up — user can use controls
      });
    });

    modalContentEl.appendChild(video);
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalEl.classList.add("hidden");
    modalContentEl.innerHTML = "";
    document.body.style.overflow = "";
  }

  modalCloseEl.addEventListener("click", closeModal);
  modalEl.addEventListener("click", function (e) {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modalEl.classList.contains("hidden")) closeModal();
  });

  // Thumbnail click: video → modal, no video → open X
  tweetListEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".thumb-btn");
    if (!btn) return;
    e.preventDefault();
    var videoUrl = btn.getAttribute("data-video");
    var posterUrl = btn.getAttribute("data-poster");
    var tweetUrl = btn.getAttribute("data-tweet-url");
    if (videoUrl) {
      openVideoModal(videoUrl, posterUrl, tweetUrl);
    } else if (tweetUrl) {
      window.open(tweetUrl, "_blank", "noopener");
    }
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
