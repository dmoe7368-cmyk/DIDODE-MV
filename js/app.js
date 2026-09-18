import { DRIVE_CONFIG, PROXY_CONFIG } from "./config.js";
import { dbManager } from "./db.js";
import { M3UParser } from "./m3u-parser.js";

/**
 * CineStream Main Controller
 * Integrated Features:
 * 1. Built-in M3U Stream Health Checker & Status Badges (Live, Dead, Checking).
 * 2. Dedicated Sports Detection & Priority Filter.
 * 3. Compact Group Dropdown (No infinite column bugs).
 * 4. In-Player Quick Channel Switcher (⏮ Prev / Next ⏭ / ☰ Channels Drawer).
 * 5. Clean Stereo Passthrough (No audio distortion/clipping).
 * 6. Custom Glassmorphic Modal Dialog (No browser confirm popups with domain headers).
 */
class CineStreamController {
  constructor() {
    this.driveMovies = [];
    this.localMovies = [];
    this.m3uChannels = [];
    this.currentIptvGroupList = [];
    this.activeCategory = "drive";
    this.selectedM3uCategory = "all";
    this.currentPlayingChannelIndex = -1;
    this.isCheckingStreams = false;
    this.showOnlyLive = false;
    this.abortCheckerController = null;

    this.history = this.loadHistory();
    this.activeMedia = null;
    this.hlsInstance = null;
    this.tapTimer = 0;
    this.isLandscape = false;
    this.pendingConfirmCallback = null;

    this.cacheDom();
    this.initEvents();
    this.bootApp();
  }

  cacheDom() {
    this.dom = {
      // Views & Navigation
      viewHome: document.getElementById("viewHome"),
      viewDetails: document.getElementById("viewDetails"),
      viewSearch: document.getElementById("viewSearch"),
      navItems: document.querySelectorAll(".bottom-nav .nav-item"),
      btnHeaderSearch: document.getElementById("btnHeaderSearch"),

      // Main Sections
      sectionDrive: document.getElementById("sectionDrive"),
      sectionIptv: document.getElementById("sectionIptv"),
      sectionDevice: document.getElementById("sectionDevice"),
      rowHistorySection: document.getElementById("rowHistorySection"),
      catTabs: document.querySelectorAll(".cat-tab"),

      // Badges
      driveCountBadge: document.getElementById("driveCountBadge"),
      m3uCountBadge: document.getElementById("m3uCountBadge"),
      localCountBadge: document.getElementById("localCountBadge"),

      // IPTV Filter Controls
      selectIptvGroup: document.getElementById("selectIptvGroup"),
      inputIptvSearch: document.getElementById("inputIptvSearch"),
      btnCheckStreams: document.getElementById("btnCheckStreams"),
      btnFilterLiveOnly: document.getElementById("btnFilterLiveOnly"),
      checkerProgressWrap: document.getElementById("checkerProgressWrap"),
      checkerProgressBar: document.getElementById("checkerProgressBar"),

      // In-Player Controls & Switcher Drawer
      iptvPlayerControls: document.getElementById("iptvPlayerControls"),
      btnPrevChannel: document.getElementById("btnPrevChannel"),
      btnNextChannel: document.getElementById("btnNextChannel"),
      btnToggleChannelDrawer: document.getElementById("btnToggleChannelDrawer"),
      channelDrawer: document.getElementById("channelDrawer"),
      btnCloseDrawer: document.getElementById("btnCloseDrawer"),
      drawerGroupTitle: document.getElementById("drawerGroupTitle"),
      drawerChannelList: document.getElementById("drawerChannelList"),

      // Upload Controls
      btnOpenUploadModal: document.getElementById("btnOpenUploadModal"),
      mediaActionSheet: document.getElementById("mediaActionSheet"),
      btnCloseSheet: document.getElementById("btnCloseSheet"),
      txtM3uPaste: document.getElementById("txtM3uPaste"),
      btnProcessPaste: document.getElementById("btnProcessPaste"),
      m3uFileInput: document.getElementById("m3uFileInput"),
      videoUploadInput: document.getElementById("videoUploadInput"),
      directVideoUploadInput: document.getElementById("directVideoUploadInput"),

      // Hero Showcase
      heroBackdrop: document.getElementById("heroBackdrop"),
      heroTitle: document.getElementById("heroTitle"),
      heroBadge: document.getElementById("heroBadge"),
      btnHeroWatch: document.getElementById("btnHeroWatch"),
      btnHeroInfo: document.getElementById("btnHeroInfo"),

      // Scrollers & Grids
      scrollerDrive: document.getElementById("scrollerDrive"),
      scrollerM3U: document.getElementById("scrollerM3U"),
      scrollerLocal: document.getElementById("scrollerLocal"),
      scrollerHistory: document.getElementById("scrollerHistory"),
      driveLoading: document.getElementById("driveLoading"),

      // Buttons
      btnRefreshDrive: document.getElementById("btnRefreshDrive"),
      btnExportM3U: document.getElementById("btnExportM3U"),
      btnClearM3U: document.getElementById("btnClearM3U"),
      btnClearLocal: document.getElementById("btnClearLocal"),
      btnClearHistory: document.getElementById("btnClearHistory"),

      // Custom Confirmation Modal
      customConfirmModal: document.getElementById("customConfirmModal"),
      dialogTitle: document.getElementById("dialogTitle"),
      dialogMessage: document.getElementById("dialogMessage"),
      btnCancelDialog: document.getElementById("btnCancelDialog"),
      btnConfirmDialog: document.getElementById("btnConfirmDialog"),

      // Player & Details Modal
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
  }

  initEvents() {
    // Bottom Tab Router
    this.dom.navItems.forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.target, btn));
    });

    if (this.dom.btnHeaderSearch) {
      this.dom.btnHeaderSearch.addEventListener("click", () => {
        const searchTab = document.querySelector('[data-target="viewSearch"]');
        this.switchTab("viewSearch", searchTab);
      });
    }

    // Main Category Selector
    this.dom.catTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.dom.catTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.switchMainCategory(tab.dataset.target);
      });
    });

    // IPTV Group Dropdown & Search Filter
    if (this.dom.selectIptvGroup) {
      this.dom.selectIptvGroup.addEventListener("change", (e) => {
        this.selectedM3uCategory = e.target.value.toLowerCase();
        this.renderM3UGrid();
      });
    }
    if (this.dom.inputIptvSearch) {
      this.dom.inputIptvSearch.addEventListener("input", () => this.renderM3UGrid());
    }

    // Stream Health Checker Listeners
    if (this.dom.btnCheckStreams) {
      this.dom.btnCheckStreams.addEventListener("click", () => this.startHealthChecking());
    }
    if (this.dom.btnFilterLiveOnly) {
      this.dom.btnFilterLiveOnly.addEventListener("click", () => this.toggleLiveOnlyFilter());
    }

    // In-Player Channel Switcher
    if (this.dom.btnPrevChannel) {
      this.dom.btnPrevChannel.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchChannelDelta(-1);
      });
    }
    if (this.dom.btnNextChannel) {
      this.dom.btnNextChannel.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchChannelDelta(1);
      });
    }
    if (this.dom.btnToggleChannelDrawer) {
      this.dom.btnToggleChannelDrawer.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleChannelDrawer();
      });
    }
    if (this.dom.btnCloseDrawer) {
      this.dom.btnCloseDrawer.addEventListener("click", (e) => {
        e.stopPropagation();
        this.dom.channelDrawer.classList.remove("active");
      });
    }

    // Upload Modal Sheet Trigger
    if (this.dom.btnOpenUploadModal) {
      this.dom.btnOpenUploadModal.addEventListener("click", () => {
        this.dom.mediaActionSheet.classList.add("active");
      });
    }
    if (this.dom.btnCloseSheet) {
      this.dom.btnCloseSheet.addEventListener("click", () => {
        this.dom.mediaActionSheet.classList.remove("active");
      });
    }

    // Video Upload Inputs
    [this.dom.videoUploadInput, this.dom.directVideoUploadInput].forEach((input) => {
      if (input) {
        input.accept = "video/*,.mkv,.mp4,.webm,.avi,.mov";
        input.addEventListener("change", (e) => this.handleLocalVideoUpload(e));
      }
    });

    // Custom Clean Dialogs
    if (this.dom.btnClearLocal) {
      this.dom.btnClearLocal.addEventListener("click", () => {
        this.openConfirmDialog(
          "Clean Storage",
          "Device ပေါ်တွင် သိမ်းဆည်းထားသော ဒေသတွင်း ရုပ်ရှင်အားလုံးကို ဖျက်မည်လား?",
          () => this.clearLocalStorage()
        );
      });
    }

    if (this.dom.btnClearM3U) {
      this.dom.btnClearM3U.addEventListener("click", () => {
        this.openConfirmDialog(
          "Clean IPTV Channels",
          "IPTV Channel စာရင်းအားလုံးကို အပြီးတိုင် ဖျက်မည်လား? မဖျက်ခင် 'Save .m3u' ဖြင့် backup ယူထားနိုင်ပါသည်။",
          () => this.clearM3UChannels()
        );
      });
    }

    if (this.dom.btnCancelDialog) {
      this.dom.btnCancelDialog.addEventListener("click", () => this.closeConfirmDialog());
    }
    if (this.dom.btnConfirmDialog) {
      this.dom.btnConfirmDialog.addEventListener("click", () => {
        if (typeof this.pendingConfirmCallback === "function") {
          this.pendingConfirmCallback();
        }
        this.closeConfirmDialog();
      });
    }

    // M3U Actions
    if (this.dom.btnProcessPaste) {
      this.dom.btnProcessPaste.addEventListener("click", () => this.handleM3uDirectPaste());
    }
    if (this.dom.m3uFileInput) {
      this.dom.m3uFileInput.addEventListener("change", (e) => this.handleM3uFile(e));
    }
    if (this.dom.btnExportM3U) {
      this.dom.btnExportM3U.addEventListener("click", () => this.exportM3UBackup());
    }

    // Drive Sync & History Clear
    if (this.dom.btnRefreshDrive) {
      this.dom.btnRefreshDrive.addEventListener("click", () => this.fetchDriveCatalog());
    }
    if (this.dom.btnClearHistory) {
      this.dom.btnClearHistory.addEventListener("click", () => this.clearHistory());
    }

    // Player Modal Actions
    if (this.dom.btnBackDetails) {
      this.dom.btnBackDetails.addEventListener("click", () => this.closeDetailsScreen());
    }
    if (this.dom.btnResumeVideo) {
      this.dom.btnResumeVideo.addEventListener("click", () => this.togglePlayback());
    }
    if (this.dom.btnRotateView) {
      this.dom.btnRotateView.addEventListener("click", () => this.toggleScreenRotation());
    }
    if (this.dom.playerContainer) {
      this.dom.playerContainer.addEventListener("click", (e) => this.handleDoubleTapSeek(e));
    }
    if (this.dom.mainVideo) {
      this.dom.mainVideo.addEventListener("timeupdate", () => this.onTimeUpdate());
    }

    if (this.dom.inputSearchQuery) {
      this.dom.inputSearchQuery.addEventListener("input", (e) => this.renderSearchGrid(e.target.value));
    }
  }

  async bootApp() {
    try {
      await dbManager.init();
    } catch (e) {
      console.warn("Database Init Warning:", e);
    }
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
    setTimeout(() => this.dom.toast.classList.remove("show"), 3000);
  }

  openConfirmDialog(title, message, onConfirm) {
    this.dom.dialogTitle.textContent = title;
    this.dom.dialogMessage.textContent = message;
    this.pendingConfirmCallback = onConfirm;
    this.dom.customConfirmModal.classList.add("active");
  }

  closeConfirmDialog() {
    this.dom.customConfirmModal.classList.remove("active");
    this.pendingConfirmCallback = null;
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
    document.querySelectorAll(".screen-view").forEach((v) => {
      v.style.display = "none";
      v.classList.remove("active");
    });
    this.dom.navItems.forEach((n) => n.classList.remove("active"));

    const targetView = document.getElementById(tabId);
    if (targetView) {
      targetView.style.display = "block";
      targetView.classList.add("active");
    }
    if (clickedBtn) clickedBtn.classList.add("active");

    if (tabId === "viewSearch") {
      this.renderSearchGrid("");
    }
  }

  switchMainCategory(catKey) {
    this.activeCategory = catKey;
    if (this.dom.sectionDrive) this.dom.sectionDrive.style.display = catKey === "drive" ? "block" : "none";
    if (this.dom.sectionIptv) this.dom.sectionIptv.style.display = catKey === "iptv" ? "block" : "none";
    if (this.dom.sectionDevice) this.dom.sectionDevice.style.display = catKey === "device" ? "block" : "none";

    if (catKey === "device") {
      this.renderLocalRow();
    } else if (catKey === "iptv") {
      this.renderM3UGrid();
    } else {
      this.renderDriveRow();
    }
  }

  getSafePoster(title, isLive = false) {
    const cleanTitle = (title || "Media").substring(0, 16).replace(/[<>&"']/g, "");
    const color = isLive ? "#dc2626" : "#7042f4";
    const svgString = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><rect width='100%' height='100%' fill='#171a29'/><circle cx='150' cy='85' r='32' fill='${color}' opacity='0.85'/><polygon points='143,72 163,85 143,98' fill='#ffffff'/><text x='50%' y='145' font-family='sans-serif' font-size='13' font-weight='bold' fill='#9aa0b8' text-anchor='middle'>${cleanTitle}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
  }

  /* ================= Stream Health Checker Engine ================= */
  async checkStreamHealth(url, signal) {
    if (!url || /youtube\.com|twitch\.tv|dailymotion\.com/i.test(url)) return "dead";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500); // 4.5s probe timeout

    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const probeUrl = `${PROXY_CONFIG.CORS_PROXY}${encodeURIComponent(url)}`;
      const res = await fetch(probeUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "Range": "bytes=0-512" } // Fetch header chunk only
      });
      clearTimeout(timer);
      return res.ok ? "live" : "dead";
    } catch {
      clearTimeout(timer);
      return "dead";
    }
  }

  async startHealthChecking() {
    if (this.isCheckingStreams || this.currentIptvGroupList.length === 0) {
      this.showToast("စစ်ဆေးရန် Channel စာရင်း မရှိပါ");
      return;
    }

    this.isCheckingStreams = true;
    this.abortCheckerController = new AbortController();
    this.dom.checkerProgressWrap.style.display = "block";
    this.dom.checkerProgressBar.style.width = "0%";
    this.dom.btnCheckStreams.textContent = "⏹ Stop Checking";
    this.showToast("Channels စစ်ဆေးနေပါသည်...");

    const targetList = [...this.currentIptvGroupList];
    let completed = 0;
    const total = targetList.length;

    const concurrency = 4; // Check 4 channels concurrently
    const queue = [...targetList];

    const worker = async () => {
      while (queue.length > 0) {
        if (this.abortCheckerController.signal.aborted) break;
        const channel = queue.shift();
        channel.health = "checking";
        this.updateCardBadge(channel.id, "checking");

        const status = await this.checkStreamHealth(channel.streamUrl, this.abortCheckerController.signal);
        channel.health = status;
        this.updateCardBadge(channel.id, status);

        completed++;
        const pct = Math.round((completed / total) * 100);
        this.dom.checkerProgressBar.style.width = `${pct}%`;
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    this.isCheckingStreams = false;
    this.dom.btnCheckStreams.textContent = "⚡ Check Health";
    this.dom.checkerProgressWrap.style.display = "none";
    this.showToast("စစ်ဆေးမှု ပြီးဆုံးပါပြီ!");
  }

  updateCardBadge(channelId, status) {
    const card = document.querySelector(`[data-card-id="${channelId}"]`);
    if (card) {
      let badge = card.querySelector(".health-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "health-badge";
        card.querySelector(".poster-thumb-wrap").appendChild(badge);
      }
      badge.className = `health-badge ${status}`;
      badge.textContent = status === "live" ? "LIVE" : status === "dead" ? "DEAD" : "...";
    }
  }

  toggleLiveOnlyFilter() {
    this.showOnlyLive = !this.showOnlyLive;
    this.dom.btnFilterLiveOnly.textContent = this.showOnlyLive ? "🟢 All Channels" : "🟢 Live Only";
    this.dom.btnFilterLiveOnly.classList.toggle("text-primary", this.showOnlyLive);
    this.renderM3UGrid();
  }

  /* ================= 1. Device Storage Operations ================= */
  async handleLocalVideoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (this.dom.mediaActionSheet) {
      this.dom.mediaActionSheet.classList.remove("active");
    }
    this.showToast("Loading video file...");

    const title = file.name.replace(/\.[^/.]+$/, "");
    const streamUrl = URL.createObjectURL(file);
    const videoItem = {
      id: "local-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      title,
      fileName: file.name,
      folderName: "Device Storage",
      fileBlob: file,
      posterUrl: this.getSafePoster(title, false),
      streamUrl: streamUrl,
      isLocal: true,
      duration: 0
    };

    this.localMovies.unshift(videoItem);
    if (this.dom.localCountBadge) {
      this.dom.localCountBadge.textContent = this.localMovies.length;
    }

    this.renderLocalRow();
    this.renderHistoryRow();
    this.renderSearchGrid(this.dom.inputSearchQuery ? this.dom.inputSearchQuery.value : "");

    const deviceTab = document.querySelector('[data-target="device"]');
    if (deviceTab) deviceTab.click();

    try {
      if (dbManager && typeof dbManager.saveVideo === "function") {
        await dbManager.saveVideo(videoItem);
        this.showToast("Video stored permanently!");
      }
    } catch (err) {
      console.warn("Storage quota warning (in-memory mode):", err);
      this.showToast("Video ready for current session!");
    }

    e.target.value = "";
  }

  async loadLocalVideos() {
    try {
      if (!dbManager) return;
      const records = await dbManager.getAllVideos();
      if (Array.isArray(records) && records.length > 0) {
        this.localMovies = records
          .filter((r) => r && (r.fileBlob || r.streamUrl))
          .map((r) => ({
            ...r,
            posterUrl: r.posterUrl || this.getSafePoster(r.title, false),
            streamUrl: r.fileBlob ? URL.createObjectURL(r.fileBlob) : (r.streamUrl || "")
          }));
      }
      if (this.dom.localCountBadge) {
        this.dom.localCountBadge.textContent = this.localMovies.length;
      }
      this.renderLocalRow();
      this.renderHistoryRow();
    } catch (err) {
      console.warn("Video retrieval note:", err);
    }
  }

  renderLocalRow() {
    if (!this.dom.scrollerLocal) return;
    this.dom.scrollerLocal.innerHTML = "";

    if (this.localMovies.length === 0) {
      this.dom.scrollerLocal.innerHTML = `
        <div class="empty-box">
          <p>No device movies uploaded yet.</p>
          <button type="button" id="btnEmptyUploadAction" class="btn btn-purple" style="cursor:pointer;">+ Upload Movie</button>
        </div>
      `;
      const btn = document.getElementById("btnEmptyUploadAction");
      if (btn) {
        btn.onclick = () => {
          if (this.dom.directVideoUploadInput) {
            this.dom.directVideoUploadInput.click();
          } else if (this.dom.videoUploadInput) {
            this.dom.videoUploadInput.click();
          }
        };
      }
      return;
    }

    this.localMovies.forEach((m) => {
      this.dom.scrollerLocal.appendChild(this.createPosterCard(m));
    });
  }

  async clearLocalStorage() {
    try {
      if (dbManager && typeof dbManager.clearVideos === "function") {
        await dbManager.clearVideos();
      }
    } catch (e) {
      console.warn("DB clear notice:", e);
    }

    this.localMovies.forEach((m) => {
      if (m.streamUrl && m.streamUrl.startsWith("blob:")) {
        try { URL.revokeObjectURL(m.streamUrl); } catch (_) {}
      }
    });
    this.localMovies = [];
    if (this.dom.localCountBadge) {
      this.dom.localCountBadge.textContent = "0";
    }
    this.renderLocalRow();
    this.renderSearchGrid(this.dom.inputSearchQuery ? this.dom.inputSearchQuery.value : "");
    this.showToast("Device storage cleaned successfully!");
  }

  /* ================= 2. Live IPTV Engine ================= */
  async handleM3uDirectPaste() {
    const text = this.dom.txtM3uPaste.value.trim();
    if (!text) {
      this.showToast("ကျေးဇူးပြု၍ .m3u Link သို့မဟုတ် Text ကို ထည့်ပါ");
      return;
    }

    this.dom.mediaActionSheet.classList.remove("active");
    this.showToast("Processing M3U playlist...");

    if ((text.startsWith("http://") || text.startsWith("https://")) && !text.includes("\n")) {
      try {
        const proxyUrl = PROXY_CONFIG.USE_PROXY ? `${PROXY_CONFIG.CORS_PROXY}${encodeURIComponent(text)}` : text;
        const res = await fetch(proxyUrl);
        const fetchedText = await res.text();
        const channels = M3UParser.parse(fetchedText);

        if (channels.length === 0) throw new Error("Empty playlist");

        await dbManager.saveChannels(channels);
        await this.loadSavedM3UChannels();
        this.dom.txtM3uPaste.value = "";
        this.showToast(`Imported ${channels.length} Live Channels!`);
        return;
      } catch (err) {
        const single = [{
          id: "m3u-" + Date.now(),
          title: "Direct Stream",
          logo: "",
          group: "Pasted Link",
          category: "General",
          isSports: false,
          health: "pending",
          streamUrl: text,
          isM3U: true
        }];
        await dbManager.saveChannels(single);
        await this.loadSavedM3UChannels();
        this.dom.txtM3uPaste.value = "";
        this.showToast("Loaded 1 Stream Channel!");
        return;
      }
    }

    const channels = M3UParser.parse(text);
    if (channels.length === 0) {
      this.showToast("No direct streams found");
      return;
    }

    await dbManager.saveChannels(channels);
    await this.loadSavedM3UChannels();
    this.dom.txtM3uPaste.value = "";
    this.showToast(`Saved ${channels.length} Channels!`);
  }

  async handleM3uFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.dom.mediaActionSheet.classList.remove("active");
    this.showToast("Reading M3U playlist...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const channels = M3UParser.parse(event.target.result);
        if (channels.length === 0) throw new Error("No streamable links");

        await dbManager.saveChannels(channels);
        await this.loadSavedM3UChannels();
        this.showToast(`Parsed ${channels.length} live channels!`);
      } catch (err) {
        this.showToast("File format invalid");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async loadSavedM3UChannels() {
    try {
      this.m3uChannels = await dbManager.getAllChannels();
      if (this.dom.m3uCountBadge) {
        this.dom.m3uCountBadge.textContent = this.m3uChannels.length;
      }
      this.populateIptvGroups();
      this.renderM3UGrid();
    } catch (err) {
      console.error(err);
    }
  }

  populateIptvGroups() {
    if (!this.dom.selectIptvGroup) return;

    const rawGroups = this.m3uChannels.map((c) => c.group || c.category || "General");
    const uniqueGroups = Array.from(new Set(rawGroups.map((g) => g.trim())));

    this.dom.selectIptvGroup.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "🌐 All Categories / Countries";
    this.dom.selectIptvGroup.appendChild(optAll);

    const sportsCount = this.m3uChannels.filter((c) => c.isSports || (c.category && c.category.toLowerCase() === "sports") || (c.group && c.group.toLowerCase().includes("sport"))).length;
    if (sportsCount > 0) {
      const optSports = document.createElement("option");
      optSports.value = "sports";
      optSports.textContent = `⚽ Sports Channels (${sportsCount})`;
      if (this.selectedM3uCategory === "sports") optSports.selected = true;
      this.dom.selectIptvGroup.appendChild(optSports);
    }

    uniqueGroups
      .filter((g) => g.toLowerCase() !== "sports")
      .sort((a, b) => a.localeCompare(b))
      .forEach((grp) => {
        const opt = document.createElement("option");
        opt.value = grp;
        opt.textContent = `📁 ${grp}`;
        if (grp.toLowerCase() === this.selectedM3uCategory) opt.selected = true;
        this.dom.selectIptvGroup.appendChild(opt);
      });
  }

  renderM3UGrid() {
    if (!this.dom.scrollerM3U) return;
    this.dom.scrollerM3U.innerHTML = "";

    if (this.m3uChannels.length === 0) {
      this.dom.scrollerM3U.innerHTML = `
        <div class="empty-box">
          <p>No IPTV channels available.</p>
          <button type="button" id="btnOpenIptvModal" class="btn btn-purple">＋ Add M3U Channels</button>
        </div>
      `;
      const btn = document.getElementById("btnOpenIptvModal");
      if (btn) btn.onclick = () => this.dom.mediaActionSheet.classList.add("active");
      return;
    }

    const searchTerm = (this.dom.inputIptvSearch ? this.dom.inputIptvSearch.value : "").toLowerCase().trim();

    this.currentIptvGroupList = this.m3uChannels.filter((c) => {
      const itemGroup = (c.group || c.category || "General").toLowerCase();
      const isSportsMatch = this.selectedM3uCategory === "sports" && (c.isSports || itemGroup.includes("sport") || (c.category && c.category.toLowerCase() === "sports"));
      const isStandardMatch = this.selectedM3uCategory === "all" || itemGroup === this.selectedM3uCategory;
      const matchGroup = isSportsMatch || isStandardMatch;
      const matchSearch = !searchTerm || c.title.toLowerCase().includes(searchTerm);
      const matchLiveOnly = !this.showOnlyLive || c.health === "live";

      return matchGroup && matchSearch && matchLiveOnly;
    });

    if (this.currentIptvGroupList.length === 0) {
      this.dom.scrollerM3U.innerHTML = `<div class="empty-box"><p>No channels match the filter (Try 'Check Health' first).</p></div>`;
      return;
    }

    this.currentIptvGroupList.forEach((ch, idx) => {
      const card = this.createPosterCard({
        id: ch.id,
        title: ch.title,
        folderName: ch.isSports ? "⚽ Sports" : (ch.group || ch.category || "Live TV"),
        posterUrl: ch.logo || this.getSafePoster(ch.title, true),
        streamUrl: ch.streamUrl,
        isM3U: true,
        health: ch.health || "pending",
        channelIndex: idx
      });
      this.dom.scrollerM3U.appendChild(card);
    });
  }

  /* In-Player Channel Switcher Drawer */
  toggleChannelDrawer() {
    const drawer = this.dom.channelDrawer;
    if (!drawer) return;

    const isActive = drawer.classList.contains("active");
    if (isActive) {
      drawer.classList.remove("active");
    } else {
      this.renderDrawerChannelList();
      drawer.classList.add("active");
    }
  }

  renderDrawerChannelList() {
    const list = this.dom.drawerChannelList;
    if (!list) return;
    list.innerHTML = "";

    const activeList = this.currentIptvGroupList.length > 0 ? this.currentIptvGroupList : this.m3uChannels;
    this.dom.drawerGroupTitle.textContent = `Channels (${activeList.length})`;

    activeList.forEach((ch, idx) => {
      const item = document.createElement("div");
      const isCurrent = this.activeMedia && this.activeMedia.id === ch.id;
      item.className = `drawer-channel-item ${isCurrent ? "active" : ""}`;

      item.innerHTML = `
        <img class="drawer-thumb" src="${ch.logo || this.getSafePoster(ch.title, true)}" onerror="this.src='${this.getSafePoster(ch.title, true)}'" />
        <span class="drawer-title">${ch.title}</span>
      `;

      item.onclick = (e) => {
        e.stopPropagation();
        this.currentPlayingChannelIndex = idx;
        this.openDetailsScreen({ ...ch, isM3U: true }, true);
        this.dom.channelDrawer.classList.remove("active");
      };

      list.appendChild(item);
    });
  }

  switchChannelDelta(delta) {
    const activeList = this.currentIptvGroupList.length > 0 ? this.currentIptvGroupList : this.m3uChannels;
    if (activeList.length === 0) return;

    if (this.currentPlayingChannelIndex === -1) {
      this.currentPlayingChannelIndex = activeList.findIndex((c) => this.activeMedia && c.id === this.activeMedia.id);
    }

    let nextIndex = this.currentPlayingChannelIndex + delta;
    if (nextIndex < 0) nextIndex = activeList.length - 1;
    if (nextIndex >= activeList.length) nextIndex = 0;

    this.currentPlayingChannelIndex = nextIndex;
    const nextChannel = activeList[nextIndex];
    if (nextChannel) {
      this.openDetailsScreen({ ...nextChannel, isM3U: true }, true);
      this.showToast(`Switched to: ${nextChannel.title}`);
    }
  }

  exportM3UBackup() {
    if (this.m3uChannels.length === 0) {
      this.showToast("No channels to backup");
      return;
    }

    let m3uContent = "#EXTM3U\n";
    this.m3uChannels.forEach((ch) => {
      m3uContent += `#EXTINF:-1 tvg-logo="${ch.logo || ''}" group-title="${ch.group || ch.category || 'Live'}",${ch.title}\n${ch.streamUrl}\n`;
    });

    const blob = new Blob([m3uContent], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CineStream_Backup_${Date.now()}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(".m3u backup saved to download!");
  }

  async clearM3UChannels() {
    await dbManager.clearChannels();
    this.m3uChannels = [];
    this.currentIptvGroupList = [];
    this.selectedM3uCategory = "all";
    if (this.dom.m3uCountBadge) {
      this.dom.m3uCountBadge.textContent = "0";
    }
    this.populateIptvGroups();
    this.renderM3UGrid();
    this.showToast("All IPTV channels cleared!");
  }

  /* ================= 3. Google Drive Operations ================= */
  async fetchDriveCatalog() {
    if (this.dom.driveLoading) this.dom.driveLoading.style.display = "block";
    this.showToast("Syncing Google Drive...");

    try {
      const qFolders = encodeURIComponent(
        `'${DRIVE_CONFIG.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFolders}&key=${DRIVE_CONFIG.apiKey}&fields=files(id,name)`);
      const data = await res.json();

      if (!data.files || data.files.length === 0) throw new Error("No folders found");

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

          if (!posterUrl) posterUrl = this.getSafePoster(title, false);

          if (streamUrl) {
            return { id: folder.id, folderName: folder.name, title, posterUrl, streamUrl };
          }
          return null;
        })
      );

      this.driveMovies = movies.filter(Boolean);
      if (this.dom.driveCountBadge) {
        this.dom.driveCountBadge.textContent = this.driveMovies.length;
      }
      this.renderHeroBanner();
      this.renderDriveRow();
      this.renderHistoryRow();
      this.showToast(`Loaded ${this.driveMovies.length} Drive Movies!`);
    } catch (err) {
      console.warn("Drive sync note:", err);
    } finally {
      if (this.dom.driveLoading) this.dom.driveLoading.style.display = "none";
    }
  }

  renderDriveRow() {
    if (!this.dom.scrollerDrive) return;
    this.dom.scrollerDrive.innerHTML = "";
    this.driveMovies.forEach((m) => this.dom.scrollerDrive.appendChild(this.createPosterCard(m)));
  }

  renderHeroBanner() {
    const featured = this.driveMovies[0] || this.localMovies[0];
    if (!featured || !this.dom.heroBackdrop) return;

    this.dom.heroBackdrop.src = featured.posterUrl;
    this.dom.heroBackdrop.onerror = () => {
      this.dom.heroBackdrop.src = this.getSafePoster(featured.title, false);
    };

    this.dom.heroTitle.textContent = featured.title;
    this.dom.heroBadge.textContent = featured.folderName.toUpperCase();

    this.dom.btnHeroWatch.onclick = () => this.openDetailsScreen(featured, true);
    this.dom.btnHeroInfo.onclick = () => this.openDetailsScreen(featured, false);
  }

  /* ================= Card Element Rendering ================= */
  createPosterCard(item, progress = 0) {
    const card = document.createElement("div");
    card.className = "poster-card";
    card.setAttribute("data-card-id", item.id);

    const healthBadge = item.isM3U && item.health && item.health !== "pending"
      ? `<span class="health-badge ${item.health}">${item.health === "live" ? "LIVE" : item.health === "dead" ? "DEAD" : "..."}</span>`
      : "";

    card.innerHTML = `
      <div class="poster-thumb-wrap">
        <img alt="Thumbnail" loading="lazy" />
        ${item.isM3U ? `<span class="live-badge">IPTV</span>` : ""}
        ${healthBadge}
        ${progress > 0 ? `<div class="poster-progress" style="width: ${progress}%"></div>` : ""}
      </div>
      <h4 class="poster-title"></h4>
      <span class="poster-subtitle"></span>
    `;

    const img = card.querySelector("img");
    img.src = item.posterUrl || this.getSafePoster(item.title, item.isM3U);
    img.onerror = () => {
      img.src = this.getSafePoster(item.title, item.isM3U);
    };

    card.querySelector(".poster-title").textContent = item.title;
    card.querySelector(".poster-subtitle").textContent = `📁 ${item.folderName}`;

    card.addEventListener("click", () => {
      if (item.isM3U && typeof item.channelIndex === "number") {
        this.currentPlayingChannelIndex = item.channelIndex;
      }
      this.openDetailsScreen(item);
    });
    return card;
  }

  renderHistoryRow() {
    if (!this.dom.scrollerHistory || !this.dom.rowHistorySection) return;
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
    if (!this.dom.searchGrid) return;
    this.dom.searchGrid.innerHTML = "";
    const all = [...this.m3uChannels, ...this.driveMovies, ...this.localMovies];
    const filtered = query
      ? all.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()) || m.folderName.toLowerCase().includes(query.toLowerCase()))
      : all;

    filtered.forEach((m) => this.dom.searchGrid.appendChild(this.createPosterCard(m)));
  }

  /* ================= Streaming & Playback Controller ================= */
  openDetailsScreen(item, autoPlay = false) {
    this.activeMedia = item;
    const v = this.dom.mainVideo;

    // Clean Volume Passthrough
    v.muted = false;
    v.volume = 1.0;

    this.dom.detailsTitle.textContent = item.title;
    this.dom.detailsBadge.textContent = item.isM3U ? "LIVE IPTV" : "STREAM";
    this.dom.detailsMeta.textContent = `${item.folderName} • Clean Audio Stream`;
    
    // Toggle In-Player Quick Switcher
    if (this.dom.iptvPlayerControls) {
      this.dom.iptvPlayerControls.style.display = item.isM3U ? "flex" : "none";
    }

    this.dom.viewDetails.style.display = "block";
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
    v.muted = false;
    v.volume = 1.0;

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    let finalUrl = url;
    if (PROXY_CONFIG.USE_PROXY && url.startsWith("http") && !url.includes("googleapis.com")) {
      finalUrl = `${PROXY_CONFIG.CORS_PROXY}${encodeURIComponent(url)}`;
    }

    if (url.includes(".m3u8") && Hls.isSupported()) {
      this.hlsInstance = new Hls({
        enableWorker: true,
        manifestLoadingTimeOut: 10000
      });
      this.hlsInstance.loadSource(finalUrl);
      this.hlsInstance.attachMedia(v);
      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        v.play().catch(() => {});
      });
    } else {
      v.src = finalUrl;
      v.load();
      v.play().catch(() => {});
    }
  }

  closeDetailsScreen() {
    if (this.isLandscape) this.exitScreenRotation();
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    if (this.dom.channelDrawer) {
      this.dom.channelDrawer.classList.remove("active");
    }
    this.dom.mainVideo.pause();
    this.dom.mainVideo.src = "";
    
    this.dom.viewDetails.style.display = "none";
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
    if (!elem) return;
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
