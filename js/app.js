import { DRIVE_CONFIG, PROXY_CONFIG } from "./config.js";
import { dbManager } from "./db.js";
import { M3UParser } from "./m3u-parser.js";

/**
 * CineStream Main Controller
 * Fully integrated with Vertical Scroll Grid for M3U Channels.
 */
class CineStreamController {
  constructor() {
    this.driveMovies = [];
    this.localMovies = [];
    this.m3uChannels = [];
    this.selectedM3uCategory = "all";
    this.history = this.loadHistory();
    this.activeMedia = null;
    this.hlsInstance = null;
    this.tapTimer = 0;
    this.isLandscape = false;

    this.cacheDom();
    this.initEvents();
    this.bootApp();
  }

  cacheDom() {
    this.dom = {
      viewHome: document.getElementById("viewHome"),
      viewDetails: document.getElementById("viewDetails"),
      viewSearch: document.getElementById("viewSearch"),
      navItems: document.querySelectorAll(".bottom-nav .nav-item"),
      btnHeaderSearch: document.getElementById("btnHeaderSearch"),

      btnOpenMenu: document.getElementById("btnOpenMenu"),
      mediaActionSheet: document.getElementById("mediaActionSheet"),
      btnCloseSheet: document.getElementById("btnCloseSheet"),
      txtM3uPaste: document.getElementById("txtM3uPaste"),
      btnProcessPaste: document.getElementById("btnProcessPaste"),
      m3uFileInput: document.getElementById("m3uFileInput"),
      videoUploadInput: document.getElementById("videoUploadInput"),

      heroBackdrop: document.getElementById("heroBackdrop"),
      heroTitle: document.getElementById("heroTitle"),
      heroBadge: document.getElementById("heroBadge"),
      btnHeroWatch: document.getElementById("btnHeroWatch"),
      btnHeroInfo: document.getElementById("btnHeroInfo"),

      scrollerM3U: document.getElementById("scrollerM3U"),
      rowM3uSection: document.getElementById("rowM3uSection"),
      m3uCountBadge: document.getElementById("m3uCountBadge"),
      btnExportM3U: document.getElementById("btnExportM3U"),
      btnClearM3U: document.getElementById("btnClearM3U"),

      scrollerHistory: document.getElementById("scrollerHistory"),
      rowHistorySection: document.getElementById("rowHistorySection"),
      btnClearHistory: document.getElementById("btnClearHistory"),

      scrollerLocal: document.getElementById("scrollerLocal"),
      rowLocalSection: document.getElementById("rowLocalSection"),

      scrollerDrive: document.getElementById("scrollerDrive"),
      rowDriveSection: document.getElementById("rowDriveSection"),
      btnRefreshDrive: document.getElementById("btnRefreshDrive"),
      driveLoading: document.getElementById("driveLoading"),

      btnBackDetails: document.getElementById("btnBackDetails"),
      playerContainer: document.getElementById("playerContainer"),
      mainVideo: document.getElementById("mainVideo"),
      detailsTitle: document.getElementById("detailsTitle"),
      detailsBadge: document.getElementById("detailsBadge"),
      detailsMeta: document.getElementById("detailsMeta"),
      detailsSynopsis: document.getElementById("detailsSynopsis"),
      btnResumeVideo: document.getElementById("btnResumeVideo"),
      btnRotateView: document.getElementById("btnRotateView"),
      episodesList: document.getElementById("episodesList"),
      seekLeft: document.getElementById("seekLeft"),
      seekRight: document.getElementById("seekRight"),

      inputSearchQuery: document.getElementById("inputSearchQuery"),
      searchGrid: document.getElementById("searchGrid"),
      toast: document.getElementById("appToast")
    };

    // M3U Section ကို Vertical Grid သို့ အဆင့်မြှင့်တင်ခြင်း
    if (this.dom.rowM3uSection) {
      this.dom.rowM3uSection.className = "m3u-channels-section";
      if (this.dom.scrollerM3U) {
        this.dom.scrollerM3U.className = "channels-vertical-grid";
      }
    }

    // Dynamic Category Pills Bar
    if (this.dom.rowM3uSection && !document.getElementById("m3uCategoryBar")) {
      const catBar = document.createElement("div");
      catBar.id = "m3uCategoryBar";
      catBar.className = "pill-bar";
      catBar.style.padding = "0 0 14px 0";
      this.dom.rowM3uSection.insertBefore(catBar, this.dom.scrollerM3U);
      this.dom.m3uCategoryBar = catBar;
    } else {
      this.dom.m3uCategoryBar = document.getElementById("m3uCategoryBar");
    }
  }

  initEvents() {
    this.dom.navItems.forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.target, btn));
    });

    this.dom.btnHeaderSearch.addEventListener("click", () => {
      const searchTab = document.querySelector('[data-target="viewSearch"]');
      this.switchTab("viewSearch", searchTab);
    });

    this.dom.btnOpenMenu.addEventListener("click", () => {
      this.dom.mediaActionSheet.classList.add("active");
    });
    this.dom.btnCloseSheet.addEventListener("click", () => {
      this.dom.mediaActionSheet.classList.remove("active");
    });

    this.dom.btnProcessPaste.addEventListener("click", () => this.handleM3uDirectPaste());
    this.dom.m3uFileInput.addEventListener("change", (e) => this.handleM3uFile(e));
    this.dom.btnExportM3U.addEventListener("click", () => this.exportM3UBackup());
    this.dom.btnClearM3U.addEventListener("click", () => this.clearM3UChannels());

    this.dom.videoUploadInput.addEventListener("change", (e) => this.handleLocalVideoUpload(e));
    this.dom.btnRefreshDrive.addEventListener("click", () => this.fetchDriveCatalog());
    this.dom.btnClearHistory.addEventListener("click", () => this.clearHistory());

    this.dom.btnBackDetails.addEventListener("click", () => this.closeDetailsScreen());
    this.dom.btnResumeVideo.addEventListener("click", () => this.togglePlayback());
    this.dom.btnRotateView.addEventListener("click", () => this.toggleScreenRotation());
    this.dom.playerContainer.addEventListener("click", (e) => this.handleDoubleTapSeek(e));
    this.dom.mainVideo.addEventListener("timeupdate", () => this.onTimeUpdate());

    this.dom.inputSearchQuery.addEventListener("input", (e) => this.renderSearchGrid(e.target.value));

    document.querySelectorAll(".content-viewport > section > .pill-bar > .pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        document.querySelectorAll(".content-viewport > section > .pill-bar > .pill").forEach((p) => p.classList.remove("active"));
        e.target.classList.add("active");
        this.filterCategory(e.target.dataset.filter);
      });
    });
  }

  async bootApp() {
    await dbManager.init();
    await this.loadLocalVideos();
    await this.loadSavedM3UChannels();
    if (DRIVE_CONFIG.autoLoad) {
      await this.fetchDriveCatalog();
    }
  }

  showToast(text) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = text;
    this.dom.toast.classList.add("show");
    setTimeout(() => this.dom.toast.classList.remove("show"), 2500);
  }

  loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(DRIVE_CONFIG.storageKeyHistory)) || [];
    } catch {
      return [];
    }
  }

  saveHistory() {
    localStorage.setItem(DRIVE_CONFIG.storageKeyHistory, JSON.stringify(this.history));
  }

  switchTab(tabId, clickedBtn) {
    document.querySelectorAll(".screen-view").forEach((v) => v.classList.remove("active"));
    this.dom.navItems.forEach((n) => n.classList.remove("active"));

    const targetView = document.getElementById(tabId);
    if (targetView) targetView.classList.add("active");
    if (clickedBtn) clickedBtn.classList.add("active");

    if (tabId === "viewSearch") {
      this.renderSearchGrid("");
    }
  }

  getSafePoster(title, isLive = false) {
    const clean = encodeURIComponent((title || "Stream").slice(0, 16));
    const accent = isLive ? "%23dc2626" : "%237042f4";
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231a1d2d"/><stop offset="100%" stop-color="%23090a10"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><circle cx="150" cy="85" r="32" fill="${accent}" opacity="0.85"/><polygon points="143,72 163,85 143,98" fill="%23ffffff"/><text x="50%" y="145" font-family="sans-serif" font-size="13" font-weight="bold" fill="%239aa0b8" text-anchor="middle">${clean}</text></svg>`;
  }

  /* ================= M3U Engine (Vertical Grid & Categorization) ================= */
  async handleM3uDirectPaste() {
    const text = this.dom.txtM3uPaste.value.trim();
    if (!text) {
      this.showToast("ကျေးဇူးပြု၍ .m3u Link သို့မဟုတ် Text ကို ထည့်ပါ");
      return;
    }

    this.dom.mediaActionSheet.classList.remove("active");
    this.showToast("Processing M3U Content...");

    if ((text.startsWith("http://") || text.startsWith("https://")) && !text.includes("\n")) {
      try {
        const proxyUrl = PROXY_CONFIG.USE_PROXY ? `${PROXY_CONFIG.CORS_PROXY}${encodeURIComponent(text)}` : text;
        const res = await fetch(proxyUrl);
        const fetchedText = await res.text();
        const channels = M3UParser.parse(fetchedText);

        if (channels.length === 0) throw new Error("No channels found");

        await dbManager.saveChannels(channels);
        await this.loadSavedM3UChannels();
        this.dom.txtM3uPaste.value = "";
        this.showToast(`Imported ${channels.length} Channels!`);
        return;
      } catch (err) {
        const single = [{
          id: "m3u-" + Date.now(),
          title: "Direct Pasted Stream",
          logo: "",
          group: "Pasted Link",
          category: "General",
          streamUrl: text,
          isM3U: true
        }];
        await dbManager.saveChannels(single);
        await this.loadSavedM3UChannels();
        this.dom.txtM3uPaste.value = "";
        this.showToast("Loaded 1 Stream!");
        return;
      }
    }

    try {
      const channels = M3UParser.parse(text);
      if (channels.length === 0) throw new Error("No channels found");

      await dbManager.saveChannels(channels);
      await this.loadSavedM3UChannels();
      this.dom.txtM3uPaste.value = "";
      this.showToast(`Saved ${channels.length} Channels!`);
    } catch (err) {
      this.showToast("M3U format parse error");
    }
  }

  async handleM3uFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.dom.mediaActionSheet.classList.remove("active");
    this.showToast("Parsing M3U File...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const channels = M3UParser.parse(event.target.result);
        if (channels.length === 0) throw new Error("No channels found");

        await dbManager.saveChannels(channels);
        await this.loadSavedM3UChannels();
        this.showToast(`Imported ${channels.length} Channels!`);
      } catch (err) {
        this.showToast("File format error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async loadSavedM3UChannels() {
    try {
      this.m3uChannels = await dbManager.getAllChannels();
      this.renderM3UInterface();
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * M3U Channels များကို Category အလိုက် Vertical Scroll Grid ဖြင့် ဖော်ပြပေးခြင်း
   */
  renderM3UInterface() {
    if (!this.dom.rowM3uSection) return;

    if (this.m3uChannels.length === 0) {
      this.dom.rowM3uSection.style.display = "none";
      return;
    }

    this.dom.rowM3uSection.style.display = "block";
    this.dom.m3uCountBadge.textContent = this.m3uChannels.length;

    // 1. Group / Categories Filter Tabs
    const rawCategories = this.m3uChannels.map(c => c.category || c.group || "General");
    const categories = ["All", ...new Set(rawCategories)];

    if (this.dom.m3uCategoryBar) {
      this.dom.m3uCategoryBar.innerHTML = "";
      categories.forEach(cat => {
        const pill = document.createElement("button");
        pill.className = `pill ${this.selectedM3uCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`;
        pill.textContent = cat;
        pill.onclick = () => {
          this.selectedM3uCategory = cat.toLowerCase();
          this.renderM3UInterface();
        };
        this.dom.m3uCategoryBar.appendChild(pill);
      });
    }

    // 2. Vertical Grid သို့ Channels များ Render ပြုလုပ်ခြင်း
    this.dom.scrollerM3U.innerHTML = "";
    const filteredChannels = this.selectedM3uCategory === "all"
      ? this.m3uChannels
      : this.m3uChannels.filter(c => {
          const itemCat = (c.category || c.group || "General").toLowerCase();
          return itemCat === this.selectedM3uCategory;
        });

    filteredChannels.forEach(ch => {
      const card = this.createPosterCard({
        id: ch.id,
        title: ch.title,
        folderName: ch.category || ch.group || "Live TV",
        posterUrl: ch.logo || this.getSafePoster(ch.title, true),
        streamUrl: ch.streamUrl,
        isM3U: true
      });
      this.dom.scrollerM3U.appendChild(card);
    });
  }

  exportM3UBackup() {
    if (this.m3uChannels.length === 0) {
      this.showToast("No channels to backup");
      return;
    }

    let m3uContent = "#EXTM3U\n";
    this.m3uChannels.forEach((ch) => {
      m3uContent += `#EXTINF:-1 tvg-logo="${ch.logo || ''}" group-title="${ch.category || ch.group || 'Live'}",${ch.title}\n${ch.streamUrl}\n`;
    });

    const blob = new Blob([m3uContent], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CineStream_Backup_${Date.now()}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(".m3u file saved to download!");
  }

  async clearM3UChannels() {
    if (this.m3uChannels.length === 0) return;
    const confirmClean = confirm("Channel အားလုံးကို Clean လုပ်တော့မလား? မလုပ်ခင် 'Save .m3u' ဖြင့် သိမ်းထားနိုင်ပါသည်။");
    if (!confirmClean) return;

    await dbManager.clearChannels();
    this.m3uChannels = [];
    this.selectedM3uCategory = "all";
    this.renderM3UInterface();
    this.showToast("Cleaned all M3U channels!");
  }

  /* ================= Local Device Video Storage ================= */
  async handleLocalVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.dom.mediaActionSheet.classList.remove("active");
    this.showToast("Saving local video...");

    const title = file.name.replace(/\.[^/.]+$/, "");
    const videoItem = {
      id: "local-" + Date.now(),
      title,
      folderName: "Device Storage",
      fileBlob: file,
      isLocal: true,
      duration: 0
    };

    try {
      await dbManager.saveVideo(videoItem);
      await this.loadLocalVideos();
      this.showToast("Video stored permanently!");
    } catch (err) {
      this.showToast("Storage failed");
    }
  }

  async loadLocalVideos() {
    try {
      const records = await dbManager.getAllVideos();
      this.localMovies = records.map((r) => ({
        ...r,
        posterUrl: this.getSafePoster(r.title),
        streamUrl: URL.createObjectURL(r.fileBlob)
      }));
      this.renderLocalRow();
      this.renderHistoryRow();
    } catch (err) {
      console.error(err);
    }
  }

  renderLocalRow() {
    this.dom.scrollerLocal.innerHTML = "";
    if (this.localMovies.length === 0) {
      this.dom.rowLocalSection.style.display = "none";
      return;
    }
    this.dom.rowLocalSection.style.display = "block";
    this.localMovies.forEach((m) => this.dom.scrollerLocal.appendChild(this.createPosterCard(m)));
  }

  /* ================= Google Drive API v3 ================= */
  async fetchDriveCatalog() {
    if (this.dom.driveLoading) this.dom.driveLoading.style.display = "block";
    this.showToast("Syncing Google Drive...");

    try {
      const qFolders = encodeURIComponent(
        `'${DRIVE_CONFIG.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFolders}&key=${DRIVE_CONFIG.apiKey}&fields=files(id,name)`);
      const data = await res.json();

      if (!data.files || data.files.length === 0) throw new Error("No folders");

      const movies = await Promise.all(
        data.files.map(async (folder) => {
          const qFiles = encodeURIComponent(`'${folder.id}' in parents and trashed = false`);
          const fRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFiles}&key=${DRIVE_CONFIG.apiKey}&fields=files(id,name,mimeType)`);
          const fData = await fRes.json();
          const files = fData.files || [];

          let posterUrl = "";
          let streamUrl = "";
          let title = folder.name;

          files.forEach((f) => {
            const name = f.name.toLowerCase();
            const mime = f.mimeType || "";

            if (mime.startsWith("image/") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
              posterUrl = `https://lh3.googleusercontent.com/d/${f.id}`;
            }

            if (mime.startsWith("video/") || name.endsWith(".mp4") || name.endsWith(".mkv")) {
              title = f.name.replace(/\.[^/.]+$/, "");
              streamUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${DRIVE_CONFIG.apiKey}`;
            }
          });

          if (!posterUrl) posterUrl = this.getSafePoster(title);

          if (streamUrl) {
            return { id: folder.id, folderName: folder.name, title, posterUrl, streamUrl };
          }
          return null;
        })
      );

      this.driveMovies = movies.filter(Boolean);
      this.renderHeroBanner();
      this.renderDriveRow();
      this.renderHistoryRow();
      this.showToast(`Loaded ${this.driveMovies.length} Drive shows!`);
    } catch (err) {
      console.warn("Drive sync error:", err);
    } finally {
      if (this.dom.driveLoading) this.dom.driveLoading.style.display = "none";
    }
  }

  renderDriveRow() {
    this.dom.scrollerDrive.innerHTML = "";
    this.driveMovies.forEach((m) => this.dom.scrollerDrive.appendChild(this.createPosterCard(m)));
  }

  renderHeroBanner() {
    const featured = this.driveMovies[0] || this.localMovies[0];
    if (!featured || !this.dom.heroBackdrop) return;

    this.dom.heroBackdrop.src = featured.posterUrl;
    this.dom.heroBackdrop.onerror = () => {
      this.dom.heroBackdrop.src = this.getSafePoster(featured.title);
    };

    this.dom.heroTitle.textContent = featured.title;
    this.dom.heroBadge.textContent = featured.folderName.toUpperCase();

    this.dom.btnHeroWatch.onclick = () => this.openDetailsScreen(featured, true);
    this.dom.btnHeroInfo.onclick = () => this.openDetailsScreen(featured, false);
  }

  createPosterCard(item, progress = 0) {
    const card = document.createElement("div");
    card.className = "poster-card";

    card.innerHTML = `
      <div class="poster-thumb-wrap">
        <img src="${item.posterUrl}" alt="${item.title}" loading="lazy" />
        ${item.isM3U ? `<span class="live-badge">LIVE</span>` : ""}
        ${progress > 0 ? `<div class="poster-progress" style="width: ${progress}%"></div>` : ""}
      </div>
      <h4 class="poster-title"></h4>
      <span class="poster-subtitle"></span>
    `;

    card.querySelector(".poster-title").textContent = item.title;
    card.querySelector(".poster-subtitle").textContent = `📁 ${item.folderName}`;

    const img = card.querySelector("img");
    img.onerror = () => {
      img.src = this.getSafePoster(item.title, item.isM3U);
    };

    card.addEventListener("click", () => this.openDetailsScreen(item));
    return card;
  }

  renderHistoryRow() {
    this.dom.scrollerHistory.innerHTML = "";
    if (this.history.length === 0) {
      this.dom.rowHistorySection.style.display = "none";
      return;
    }
    this.dom.rowHistorySection.style.display = "block";

    const all = [...this.m3uChannels, ...this.localMovies, ...this.driveMovies];
    this.history.forEach((h) => {
      const match = all.find((x) => x.id === h.id);
      if (match) {
        const percent = (h.time / (h.duration || 1)) * 100;
        this.dom.scrollerHistory.appendChild(this.createPosterCard(match, percent));
      }
    });
  }

  renderSearchGrid(query) {
    this.dom.searchGrid.innerHTML = "";
    const all = [...this.m3uChannels, ...this.driveMovies, ...this.localMovies];
    const filtered = query
      ? all.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()) || m.folderName.toLowerCase().includes(query.toLowerCase()))
      : all;

    filtered.forEach((m) => this.dom.searchGrid.appendChild(this.createPosterCard(m)));
  }

  filterCategory(category) {
    if (category === "all") {
      this.dom.rowDriveSection.style.display = "block";
      this.dom.rowLocalSection.style.display = "block";
      this.dom.rowM3uSection.style.display = "block";
      return;
    }

    if (category === "live") {
      this.dom.rowM3uSection.style.display = "block";
      this.dom.rowDriveSection.style.display = "none";
      this.dom.rowLocalSection.style.display = "none";
    } else if (category === "local") {
      this.dom.rowLocalSection.style.display = "block";
      this.dom.rowM3uSection.style.display = "none";
      this.dom.rowDriveSection.style.display = "none";
    } else {
      this.dom.rowDriveSection.style.display = "block";
      this.dom.rowM3uSection.style.display = "none";
      this.dom.rowLocalSection.style.display = "none";
    }
  }

  /* ================= Playback Controller ================= */
  openDetailsScreen(item, autoPlay = false) {
    this.activeMedia = item;
    const v = this.dom.mainVideo;

    this.dom.detailsTitle.textContent = item.title;
    this.dom.detailsBadge.textContent = item.isM3U ? "LIVE IPTV" : "STREAM";
    this.dom.detailsMeta.textContent = `${item.folderName} • Adaptive Stream`;
    this.dom.viewDetails.classList.add("active");

    this.dom.episodesList.innerHTML = `
      <div class="episode-card">
        <img class="episode-thumb" src="${item.posterUrl}" onerror="this.src='${this.getSafePoster(item.title, item.isM3U)}'" />
        <div class="episode-info">
          <h5 class="episode-title">${item.title}</h5>
          <span class="episode-tag">${item.isM3U ? "🔴 Live IPTV Broadcast" : "▶ Ready to stream"}</span>
        </div>
      </div>
    `;

    this.playStream(item.streamUrl);

    const saved = this.history.find((h) => h.id === item.id);
    if (saved && saved.time > 5 && !item.isM3U) {
      v.currentTime = saved.time;
      this.dom.btnResumeVideo.textContent = `▶ Resume (${Math.floor(saved.time / 60)}m)`;
    } else {
      this.dom.btnResumeVideo.textContent = "▶ Play";
    }

    if (autoPlay) {
      v.play().catch(() => {});
      this.dom.btnResumeVideo.textContent = "⏸ Pause";
    }
  }

  playStream(url) {
    const v = this.dom.mainVideo;

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    let finalUrl = url;
    if (PROXY_CONFIG.USE_PROXY && url.startsWith("http") && !url.includes("googleapis.com")) {
      finalUrl = `${PROXY_CONFIG.CORS_PROXY}${encodeURIComponent(url)}`;
    }

    if (url.includes(".m3u8") && Hls.isSupported()) {
      this.hlsInstance = new Hls({ enableWorker: true });
      this.hlsInstance.loadSource(finalUrl);
      this.hlsInstance.attachMedia(v);
      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        v.play().catch(() => {});
      });
    } else {
      v.src = finalUrl;
      v.load();
    }
  }

  closeDetailsScreen() {
    if (this.isLandscape) this.exitScreenRotation();
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    this.dom.mainVideo.pause();
    this.dom.mainVideo.src = "";
    this.dom.viewDetails.classList.remove("active");
    this.renderHistoryRow();
  }

  togglePlayback() {
    const v = this.dom.mainVideo;
    if (v.paused) {
      v.play();
      this.dom.btnResumeVideo.textContent = "⏸ Pause";
    } else {
      v.pause();
      this.dom.btnResumeVideo.textContent = "▶ Play";
    }
  }

  toggleScreenRotation() {
    if (this.isLandscape) {
      this.exitScreenRotation();
    } else {
      this.isLandscape = true;
      this.dom.viewDetails.classList.add("force-landscape");
      this.showToast("Landscape Screen Locked");
    }
  }

  exitScreenRotation() {
    this.isLandscape = false;
    this.dom.viewDetails.classList.remove("force-landscape");
    this.showToast("Portrait Screen Restored");
  }

  handleDoubleTapSeek(e) {
    if (e.target.tagName !== "VIDEO" || (this.activeMedia && this.activeMedia.isM3U)) return;
    const now = Date.now();
    if (now - this.tapTimer < 300) {
      const box = this.dom.playerContainer.getBoundingClientRect();
      const x = e.clientX - box.left;
      if (x < box.width / 2) {
        this.dom.mainVideo.currentTime = Math.max(0, this.dom.mainVideo.currentTime - 10);
        this.flashSeek(this.dom.seekLeft);
      } else {
        this.dom.mainVideo.currentTime = Math.min(this.dom.mainVideo.duration || 0, this.dom.mainVideo.currentTime + 10);
        this.flashSeek(this.dom.seekRight);
      }
    }
    this.tapTimer = now;
  }

  flashSeek(elem) {
    elem.classList.add("visible");
    setTimeout(() => elem.classList.remove("visible"), 400);
  }

  onTimeUpdate() {
    const v = this.dom.mainVideo;
    if (!v.duration || !this.activeMedia || this.activeMedia.isM3U) return;

    const idx = this.history.findIndex((h) => h.id === this.activeMedia.id);
    const payload = {
      id: this.activeMedia.id,
      time: Math.floor(v.currentTime),
      duration: Math.floor(v.duration)
    };

    if (idx > -1) {
      this.history[idx] = payload;
    } else {
      this.history.unshift(payload);
    }
    this.saveHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.renderHistoryRow();
    this.showToast("Watch history cleared");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new CineStreamController();
});