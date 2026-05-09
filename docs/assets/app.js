(function () {
  "use strict";

  // --- Constants ---
  var REPO_OWNER = "NT-Studio-dev";
  var REPO_NAME = "x-trend-monitor";
  var WORKFLOW_FILENAME = "daily.yml";
  var FAV_KEY = "xtm_favorites_v1";
  var PAT_KEY = "xtm_github_pat_v1";

  // --- State ---
  var data = null;
  var currentPeriod = "daily";
  var currentSort = "by_views";
  var currentFilter = "";

  // --- DOM refs ---
  var lastUpdatedEl = document.getElementById("last-updated");
  var periodTabsEl = document.getElementById("period-tabs");
  var sortSelectEl = document.getElementById("sort-select");
  var filterInputEl = document.getElementById("filter-input");
  var filterClearEl = document.getElementById("filter-clear");
  var tweetListEl = document.getElementById("tweet-list");
  var loadingStateEl = document.getElementById("loading-state");
  var errorStateEl = document.getElementById("error-state");
  var errorMessageEl = document.getElementById("error-message");
  var statsLineEl = document.getElementById("stats-line");
  var favCountEl = document.getElementById("fav-count");
  var refreshBtnEl = document.getElementById("refresh-btn");
  var settingsBtnEl = document.getElementById("settings-btn");
  var settingsModalEl = document.getElementById("settings-modal");
  var settingsCloseEl = document.getElementById("settings-close");
  var patInputEl = document.getElementById("pat-input");
  var patSaveEl = document.getElementById("pat-save");
  var patClearEl = document.getElementById("pat-clear");
  var patStatusEl = document.getElementById("pat-status");
  var favExportEl = document.getElementById("fav-export");
  var favClearAllEl = document.getElementById("fav-clear");
  var refreshToastEl = document.getElementById("refresh-toast");
  var refreshSpinnerEl = document.getElementById("refresh-spinner");
  var refreshMessageEl = document.getElementById("refresh-message");
  var refreshDetailEl = document.getElementById("refresh-detail");
  var refreshToastCloseEl = document.getElementById("refresh-toast-close");

  // --- Favorites module ---
  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveFavorites(favs) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
  }
  function isFavorite(id) {
    var favs = loadFavorites();
    return Object.prototype.hasOwnProperty.call(favs, id);
  }
  function toggleFavorite(tweet) {
    var favs = loadFavorites();
    if (favs[tweet.id]) {
      delete favs[tweet.id];
    } else {
      favs[tweet.id] = Object.assign({}, tweet, { _favoritedAt: new Date().toISOString() });
    }
    saveFavorites(favs);
    updateFavCount();
    return !!favs[tweet.id];
  }
  function getFavoritesArray() {
    var favs = loadFavorites();
    return Object.keys(favs).map(function (k) { return favs[k]; });
  }
  function updateFavCount() {
    var n = Object.keys(loadFavorites()).length;
    if (n > 0) {
      favCountEl.textContent = n;
      favCountEl.classList.remove("hidden");
    } else {
      favCountEl.classList.add("hidden");
    }
  }

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
    favorites: "お気に入り",
  };

  // --- Rendering ---

  // Default cap when no filter is active. With filter active, show all matches.
  var DEFAULT_TOP_N = 50;

  function getAllTweetsForPeriod() {
    if (currentPeriod === "favorites") {
      return getFavoritesArray();
    }
    if (!data) return [];
    if (data.tweets && Array.isArray(data.tweets[currentPeriod])) {
      return data.tweets[currentPeriod];
    }
    if (data.rankings && data.rankings[currentPeriod]) {
      var pd = data.rankings[currentPeriod];
      var keys = Object.keys(pd);
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(pd[keys[i]])) return pd[keys[i]];
      }
    }
    return [];
  }

  function sortKey(tweet) {
    if (currentSort === "by_bookmarks") return (tweet.metrics && tweet.metrics.bookmarkCount) || 0;
    if (currentSort === "by_engagement") return tweet.engagementScore || 0;
    return (tweet.metrics && tweet.metrics.viewCount) || 0;
  }

  function getRankings() {
    var all = getAllTweetsForPeriod();
    var filtered = applyFilter(all);
    var sorted = filtered.slice().sort(function (a, b) {
      return sortKey(b) - sortKey(a);
    });
    // No cap when filter is active or favorites tab — show all
    if (currentFilter.trim() || currentPeriod === "favorites") return sorted;
    return sorted.slice(0, DEFAULT_TOP_N);
  }

  function applyFilter(tweets) {
    var q = currentFilter.trim().toLowerCase();
    if (!q) return tweets;
    var terms = q.split(/\s+/).filter(Boolean);
    if (terms.length === 0) return tweets;
    return tweets.filter(function (t) {
      var hay = (
        (t.text || "") + " " +
        ((t.author && t.author.userName) || "") + " " +
        ((t.author && t.author.name) || "")
      ).toLowerCase();
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });
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

    var favOn = isFavorite(tweet.id);
    var favBtn =
      '<button type="button" class="fav-btn absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-colors" data-tweet-id="' + escapeHtml(tweet.id) + '" aria-label="お気に入り" aria-pressed="' + favOn + '">' +
        '<svg class="w-4 h-4 ' + (favOn ? "text-yellow-400 fill-current" : "text-white") + '" viewBox="0 0 24 24" fill="' + (favOn ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
          '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
        "</svg>" +
      "</button>";

    var thumbAttrs = videoUrl
      ? ' data-video="' + videoUrl + '" data-poster="' + thumbUrl + '" data-tweet-url="' + escapeHtml(tweetUrl) + '"'
      : ' data-tweet-url="' + escapeHtml(tweetUrl) + '"';

    return (
      '<div class="tweet-card group flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-xdarker hover:border-xblue transition-colors">' +
        // Thumbnail (clickable: video → modal, else → X)
        '<div class="thumb-btn relative w-full bg-black aspect-video overflow-hidden cursor-pointer" role="button" tabindex="0"' + thumbAttrs + '>' +
          thumbHtml +
          playBtnHtml +
          rankBadge +
          favBtn +
          durBadge +
        "</div>" +
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
    var totalForPeriod = getAllTweetsForPeriod().length;
    var statsText;
    if (currentFilter.trim()) {
      statsText = periodLabel + " - " + rankings.length + " / " + totalForPeriod + "件 マッチ（\"" + currentFilter.trim() + "\"）";
    } else {
      var shown = Math.min(DEFAULT_TOP_N, totalForPeriod);
      statsText = periodLabel + " - 上位 " + shown + "件 / 全 " + totalForPeriod + "件";
    }
    statsLineEl.textContent = statsText;

    tweetListEl.innerHTML = "";

    if (rankings.length === 0) {
      var empty = document.createElement("div");
      empty.className = "col-span-full text-center py-16 text-gray-400 dark:text-gray-500";
      empty.textContent = currentFilter.trim()
        ? "キーワードに一致するツイートがありません"
        : "該当するデータがありません";
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

    // Container that holds the X embed
    var wrapper = document.createElement("div");
    wrapper.className = "w-full max-w-xl mx-auto bg-white rounded-lg overflow-hidden";
    wrapper.style.maxHeight = "90vh";
    wrapper.style.overflowY = "auto";

    // Loading hint shown until widgets.js renders the embed
    var loading = document.createElement("div");
    loading.className = "p-8 text-center text-gray-500 text-sm";
    loading.textContent = "ツイートを読み込み中...";
    wrapper.appendChild(loading);

    // X embed blockquote
    var bq = document.createElement("blockquote");
    bq.className = "twitter-tweet";
    bq.setAttribute("data-dnt", "true");
    bq.setAttribute("data-theme", "light");
    bq.innerHTML = '<a href="' + tweetUrl + '"></a>';
    wrapper.appendChild(bq);

    modalContentEl.appendChild(wrapper);
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Trigger widget rendering
    var renderEmbed = function () {
      if (window.twttr && window.twttr.widgets && window.twttr.widgets.load) {
        window.twttr.widgets.load(wrapper).then(function () {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
        });
      } else {
        // widgets.js still loading — retry
        setTimeout(renderEmbed, 200);
      }
    };
    renderEmbed();
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

  // Click delegation: favorite toggle wins over thumbnail (it's nested inside)
  tweetListEl.addEventListener("click", function (e) {
    var favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      var id = favBtn.getAttribute("data-tweet-id");
      var allTweets = getAllTweetsForPeriod();
      var tweet = null;
      for (var i = 0; i < allTweets.length; i++) {
        if (String(allTweets[i].id) === String(id)) { tweet = allTweets[i]; break; }
      }
      // If we couldn't find it (e.g., on favorites tab after deletion) skip
      if (!tweet) {
        var favs = loadFavorites();
        tweet = favs[id];
      }
      if (!tweet) return;
      var nowOn = toggleFavorite(tweet);
      // Re-render to update icon (and remove from favorites tab if needed)
      if (currentPeriod === "favorites" && !nowOn) {
        render();
      } else {
        // Just toggle the icon visually without full re-render
        var svg = favBtn.querySelector("svg");
        if (svg) {
          if (nowOn) {
            svg.setAttribute("fill", "currentColor");
            svg.classList.remove("text-white");
            svg.classList.add("text-yellow-400", "fill-current");
          } else {
            svg.setAttribute("fill", "none");
            svg.classList.remove("text-yellow-400", "fill-current");
            svg.classList.add("text-white");
          }
        }
        favBtn.setAttribute("aria-pressed", nowOn);
      }
      return;
    }

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

  // Filter input (debounced)
  var filterTimer = null;
  function onFilterChange() {
    currentFilter = filterInputEl.value;
    if (currentFilter.trim()) {
      filterClearEl.classList.remove("hidden");
    } else {
      filterClearEl.classList.add("hidden");
    }
    render();
  }
  filterInputEl.addEventListener("input", function () {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(onFilterChange, 120);
  });
  filterClearEl.addEventListener("click", function () {
    filterInputEl.value = "";
    onFilterChange();
    filterInputEl.focus();
  });

  // --- Settings modal & PAT ---
  function getPat() {
    try { return localStorage.getItem(PAT_KEY) || ""; } catch (e) { return ""; }
  }
  function setPat(v) {
    try {
      if (v) localStorage.setItem(PAT_KEY, v);
      else localStorage.removeItem(PAT_KEY);
    } catch (e) {}
  }

  function openSettings() {
    var current = getPat();
    patInputEl.value = current;
    patStatusEl.textContent = current ? "保存済み" : "未設定";
    patStatusEl.className = "ml-auto text-xs " + (current ? "text-green-500" : "text-gray-500");
    settingsModalEl.classList.remove("hidden");
  }
  function closeSettings() {
    settingsModalEl.classList.add("hidden");
  }
  settingsBtnEl.addEventListener("click", openSettings);
  settingsCloseEl.addEventListener("click", closeSettings);
  settingsModalEl.addEventListener("click", function (e) {
    if (e.target === settingsModalEl) closeSettings();
  });
  patSaveEl.addEventListener("click", function () {
    var v = patInputEl.value.trim();
    setPat(v);
    patStatusEl.textContent = v ? "保存しました" : "削除しました";
    patStatusEl.className = "ml-auto text-xs " + (v ? "text-green-500" : "text-gray-500");
  });
  patClearEl.addEventListener("click", function () {
    setPat("");
    patInputEl.value = "";
    patStatusEl.textContent = "削除しました";
    patStatusEl.className = "ml-auto text-xs text-gray-500";
  });

  favExportEl.addEventListener("click", function () {
    var json = JSON.stringify(getFavoritesArray(), null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "favorites-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });
  favClearAllEl.addEventListener("click", function () {
    if (!confirm("お気に入りをすべて削除しますか？")) return;
    saveFavorites({});
    updateFavCount();
    if (currentPeriod === "favorites") render();
  });

  // --- Refresh trigger (GitHub Actions workflow_dispatch) ---
  function showToast(msg, detail, busy) {
    refreshMessageEl.textContent = msg;
    refreshDetailEl.innerHTML = detail || "";
    refreshSpinnerEl.style.display = busy ? "" : "none";
    refreshToastEl.classList.remove("hidden");
  }
  function hideToast() { refreshToastEl.classList.add("hidden"); }
  refreshToastCloseEl.addEventListener("click", hideToast);

  function ghHeaders(pat) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + pat,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function dispatchWorkflow(pat) {
    var url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME +
      "/actions/workflows/" + WORKFLOW_FILENAME + "/dispatches";
    return fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders(pat)),
      body: JSON.stringify({ ref: "main" }),
    }).then(function (res) {
      if (res.status === 204) return true;
      return res.text().then(function (t) { throw new Error("GitHub API " + res.status + ": " + t); });
    });
  }

  function findLatestRun(pat, sinceISO) {
    var url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME +
      "/actions/workflows/" + WORKFLOW_FILENAME + "/runs?event=workflow_dispatch&per_page=5";
    return fetch(url, { headers: ghHeaders(pat) }).then(function (res) {
      if (!res.ok) throw new Error("GitHub runs API " + res.status);
      return res.json();
    }).then(function (data) {
      var runs = data.workflow_runs || [];
      for (var i = 0; i < runs.length; i++) {
        if (new Date(runs[i].created_at).getTime() >= sinceISO) return runs[i];
      }
      return null;
    });
  }

  function pollRun(pat, runId) {
    var url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/actions/runs/" + runId;
    return fetch(url, { headers: ghHeaders(pat) }).then(function (res) {
      if (!res.ok) throw new Error("GitHub run API " + res.status);
      return res.json();
    });
  }

  function startRefresh() {
    var pat = getPat();
    if (!pat) {
      openSettings();
      patStatusEl.textContent = "PAT が未設定です";
      patStatusEl.className = "ml-auto text-xs text-red-500";
      return;
    }

    refreshBtnEl.disabled = true;
    refreshBtnEl.classList.add("opacity-50", "pointer-events-none");
    var startTs = Date.now() - 5000; // 5 sec backoff to catch the dispatch
    showToast("ワークフローを起動中...", "", true);

    dispatchWorkflow(pat).then(function () {
      showToast("データ取得を開始しました", "GitHub Actions が実行中です。完了まで通常 4〜6 分かかります。", true);

      // Wait for the new run to appear, then poll until completion
      var runId = null;
      var findAttempts = 0;
      var lookForRun = function () {
        return findLatestRun(pat, startTs).then(function (run) {
          if (run) { runId = run.id; return run; }
          findAttempts++;
          if (findAttempts > 12) throw new Error("実行が見つかりません");
          return new Promise(function (r) { setTimeout(r, 5000); }).then(lookForRun);
        });
      };

      return lookForRun().then(function (run) {
        var runUrl = run.html_url;
        showToast("実行中...", '<a href="' + runUrl + '" target="_blank" rel="noopener" class="text-xblue underline">GitHub で確認 ↗</a>', true);

        var poll = function () {
          return new Promise(function (r) { setTimeout(r, 20000); })
            .then(function () { return pollRun(pat, runId); })
            .then(function (r) {
              if (r.status === "completed") return r;
              showToast("実行中...", '<a href="' + runUrl + '" target="_blank" rel="noopener" class="text-xblue underline">GitHub で確認 ↗</a><br>経過: ' + Math.round((Date.now() - startTs) / 1000) + "秒", true);
              return poll();
            });
        };
        return poll();
      });
    }).then(function (run) {
      if (run.conclusion === "success") {
        showToast("完了しました。データを再読込します...", "Pages の反映に追加で30秒程度かかる場合があります。", true);
        // Wait a bit for Pages rebuild, then reload data
        setTimeout(reloadData, 45000);
      } else {
        showToast("失敗しました: " + run.conclusion, '<a href="' + run.html_url + '" target="_blank" rel="noopener" class="text-xblue underline">GitHub で詳細を確認 ↗</a>', false);
        refreshBtnEl.disabled = false;
        refreshBtnEl.classList.remove("opacity-50", "pointer-events-none");
      }
    }).catch(function (err) {
      console.error(err);
      showToast("エラー", err.message, false);
      refreshBtnEl.disabled = false;
      refreshBtnEl.classList.remove("opacity-50", "pointer-events-none");
    });
  }
  refreshBtnEl.addEventListener("click", startRefresh);

  function reloadData() {
    fetch("data.json?_=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (json) {
        data = json;
        var generatedAt = json.generated_at || json.fetched_at;
        lastUpdatedEl.textContent = "Last updated: " + toJSTString(generatedAt);
        render();
        showToast("更新完了", "最新データを表示しています。", false);
        setTimeout(hideToast, 4000);
        refreshBtnEl.disabled = false;
        refreshBtnEl.classList.remove("opacity-50", "pointer-events-none");
      })
      .catch(function (err) {
        showToast("再読込に失敗", err.message + "（手動でリロードしてください）", false);
        refreshBtnEl.disabled = false;
        refreshBtnEl.classList.remove("opacity-50", "pointer-events-none");
      });
  }

  // Esc closes any open modal
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!settingsModalEl.classList.contains("hidden")) closeSettings();
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
    updateFavCount();

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
