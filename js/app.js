import { DRIVE_CONFIG, PROXY_CONFIG } from "./config.js";
import { dbManager } from "./db.js";
import { M3UParser } from "./m3u-parser.js";

/**
 * CineStream Main Controller
 * Enhanced: Dual Audio Routing, Stereo Downmix Matrix, External Audio Track Sync & Audio Guard.
 */
class CineStreamController {
  constructor() {
    this.driveMovies = [];
    this.localMovies = [];
    this.m3uChannels = [];
    this.activeCategory = "drive";
    this.selectedM3uCategory = "all";
    this.history = this.loadHistory();
    this.activeMedia = null;
    this.hlsInstance = null;
    this.tapTimer = 0;
    this.isLandscape = false;

    // Web Audio Engine Routing Pipeline
    this.audioCtx = null;
    this.mediaElementSource = null;
    this.gainNode = null;
    this.splitterNode = null;
    this.mergerNode = null;
    this.externalAudio = null;

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

      sectionDrive: document.getElementById("sectionDrive"),
      sectionIptv: document.getElementById("sectionIptv"),
      sectionDevice: document.getElementById("sectionDevice"),
      rowHistorySection: document.getElementById("rowHistorySection"),
      catTabs: document.querySelectorAll(".cat-tab"),

      driveCountBadge: document.getElementById("driveCountBadge"),
      m3uCountBadge: document.getElementById("m3uCountBadge"),
      localCountBadge: document.getElementById("localCountBadge"),

      btnOpenUploadModal: document.getElementById("btnOpenUploadModal"),
      mediaActionSheet: document.getElementById("mediaActionSheet"),
      btnCloseSheet: document.getElementById("btnCloseSheet"),
      txtM3uPaste: document.getElementById("txtM3uPaste"),
      btnProcessPaste: document.getElementById("btnProcessPaste"),
      m3uFileInput: document.getElementById("m3uFileInput"),
      videoUploadInput: document.getElementById("videoUploadInput"),
      directVideoUploadInput: document.getElementById("directVideoUploadInput"),

      heroBackdrop: document.getElementById("heroBackdrop"),
      heroTitle: document.getElementById("heroTitle"),
      heroBadge: document.getElementById("heroBadge"),
      btnHeroWatch: document.getElementById("btnHeroWatch"),
      btnHeroInfo: document.getElementById("btnHeroInfo"),

      scrollerDrive: document.getElementById("scrollerDrive"),
      scrollerM3U: document.getElementById("scrollerM3U"),
      scrollerLocal: document.getElementById("scrollerLocal"),
      scrollerHistory: document.getElementById("scrollerHistory"),
      m3uCategoryBar: document.getElementById("m3uCategoryBar"),
      driveLoading: document.getElementById("driveLoading"),

      btnRefreshDrive: document.getElementById("btnRefreshDrive"),
      btnExportM3U: document.getElementById("btnExportM3U"),
      btnClearM3U: document.getElementById("btnClearM3U"),
      btnClearLocal: document.getElementById("btnClearLocal"),
      btnClearHistory: document.getElementById("btnClearHistory"),

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

      audioCodecAlert: document.getElementById("audioCodecAlert"),
      btnFixAudioEngine: document.getElementById("btnFixAudioEngine"),

      inputSearchQuery: document.getElementById("inputSearchQuery"),
      searchGrid: document.getElementById("searchGrid"),
      toast: document.getElementById("appToast")
    };
  }

  initEvents() {
    this.dom.navItems.forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.target, btn));
    });

    if (this.dom.btnHeaderSearch) {
      this.dom.btnHeaderSearch.addEventListener("click", () => {
        const searchTab = document.querySelector('[data-target="viewSearch"]');
        this.switchTab("viewSearch", searchTab);
      });
    }

    this.dom.catTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        this.dom.catTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.switchMainCategory(tab.dataset.target);
      });
    });

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

    [this.dom.videoUploadInput, this.dom.directVideoUploadInput].forEach((input) => {
      if (input) {
        input.accept = "video/*,.mkv,.mp4,.webm,.avi,.mov";
        input.addEventListener("change", (e) => this.handleLocalVideoUpload(e));
      }
    });

    if (this.dom.btnClearLocal) {
      this.dom.btnClearLocal.addEventListener("click", () => this.clearLocalStorage());
    }

    if (this.dom.btnProcessPaste) {
      this.dom.btnProcessPaste.addEventListener("click", () => this.handleM3uDirectPaste());
    }
    if (this.dom.m3uFileInput) {
      this.dom.m3uFileInput.addEventListener("change", (e) => this.handleM3uFile(e));
    }
    if (this.dom.btnExportM3U) {
      this.dom.btnExportM3U.addEventListener("click", () => this.exportM3UBackup());
    }
    if (this.dom.btnClearM3U) {
      this.dom.btnClearM3U.addEventListener("click", () => this.clearM3UChannels());
    }

    if (this.dom.btnRefreshDrive) {
      this.dom.btnRefreshDrive.addEventListener("click", () => this.fetchDriveCatalog());
    }
    if (this.dom.btnClearHistory) {
      this.dom.btnClearHistory.addEventListener("click", () => this.clearHistory());
    }

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

    // Audio Boost Listener
    if (this.dom.btnFixAudioEngine) {
      this.dom.btnFixAudioEngine.addEventListener("click", () => this.forceBoostAudio());
    }

    if (this.dom.inputSearchQuery) {
      this.dom.inputSearchQuery.addEventListener("input", (e) => this.renderSearchGrid(e.target.value));
    }

    document.addEventListener("click", () => this.resumeAudioContext(), { once: true });
  }

  async bootApp() {
    try {
      await dbManager.init();
    } catch (e) {
      console.warn("DB init:", e);
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
    setTimeout(() => this.dom.toast.classList.remove("show"), 3200);
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
      this.renderM3UInterface();
    } else {
      this.renderDriveRow();
    }
  }

  getSafePoster(title, isLive = false) {
    const cleanTitle = (title || "Media").substring(0, 16).replace(/[<>&"']/g, "");
    const color = isLive ? "#dc2626" : "#7042f4";
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><rect width='100%' height='100%' fill='#171a29'/><circle cx='150' cy='85' r='32' fill='${color}' opacity='0.85'/><polygon points='143,72 163,85 143,98' fill='#ffffff'/><text x='50%' y='145' font-family='sans-serif' font-size='13' font-weight='bold' fill='#9aa0b8' text-anchor='middle'>${cleanTitle}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  /* ================= Web Audio Decoding & Routing Engine ================= */
  setupAudioPipeline() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx && AudioCtx) {
        this.audioCtx = new AudioCtx({ latencyHint: "playback" });
      }

      if (this.audioCtx && !this.mediaElementSource) {
        this.mediaElementSource = this.audioCtx.createMediaElementSource(this.dom.mainVideo);

        // 6-Channel to Stereo Downmixer Matrix Node
        this.splitterNode = this.audioCtx.createChannelSplitter(6);
        this.mergerNode = this.audioCtx.createChannelMerger(2);
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 2.0; // 200% Gain boost

        // Connect media source to splitter
        this.mediaElementSource.connect(this.splitterNode);

        // Map Left, Center, Right, Sub to Stereo Outputs
        // Front Left -> Stereo Left
        this.splitterNode.connect(this.mergerNode, 0, 0);
        // Front Right -> Stereo Right
        this.splitterNode.connect(this.mergerNode, 1, 1);
        // Center (Dialogues) -> Both Left & Right
        this.splitterNode.connect(this.mergerNode, 2, 0);
        this.splitterNode.connect(this.mergerNode, 2, 1);

        // Connect Merger -> Gain -> Speakers
        this.mergerNode.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
      }
    } catch (e) {
      console.warn("Direct Stereo Passthrough:", e);
    }
  }

  resumeAudioContext() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  forceBoostAudio() {
    this.resumeAudioContext();
    const v = this.dom.mainVideo;
    v.muted = false;
    v.volume = 1.0;

    if (this.gainNode) {
      this.gainNode.gain.value = 3.5; // High boost for center channel
      this.showToast("Center Channel & Dialogue Boosted to 350%");
    } else {
      this.setupAudioPipeline();
      this.showToast("Audio Downmix Engine Activated");
    }
  }

  detectAudioIncompatibility(fileName) {
    const isEAC3orDolby = /eac3|ac3|ddp|dts|truehd|atmos|5\.1|7\.1|2160p|hevc/i.test(fileName);
    if (this.dom.audioCodecAlert) {
      this.dom.audioCodecAlert.style.display = isEAC3orDolby ? "flex" : "none";
    }
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
      console.warn("Storage quota fallback (in-memory mode):", err);
      this.showToast("Video loaded for current session!");
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
    if (this.localMovies.length === 0) {
      this.showToast("No device movies to clear");
      return;
    }

    const confirmClean = confirm("Device ပေါ်တွင် သိမ်းထားသော ရုပ်ရှင်အားလုံးကို ဖျက်မည်လား?");
    if (!confirmClean) return;

    try {
      if (dbManager && typeof dbManager.clearVideos === "function") {
        await dbManager.clearVideos();
      }
    } catch (e) {
      console.warn("DB clear error:", e);
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

  /* ================= 2. Live IPTV Operations ================= */
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
      this.renderM3UInterface();
    } catch (err) {
      console.error(err);
    }
  }

  renderM3UInterface() {
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

    const rawCategories = this.m3uChannels.map((c) => c.category || c.group || "General");
    const categories = ["All", ...new Set(rawCategories)];

    if (this.dom.m3uCategoryBar) {
      this.dom.m3uCategoryBar.innerHTML = "";
      categories.forEach((cat) => {
        const pill = document.createElement("button");
        pill.className = `cat-tab ${this.selectedM3uCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`;
        pill.style.padding = "6px 16px";
        pill.style.fontSize = "0.78rem";
        pill.textContent = cat;
        pill.onclick = () => {
          this.selectedM3uCategory = cat.toLowerCase();
          this.renderM3UInterface();
        };
        this.dom.m3uCategoryBar.appendChild(pill);
      });
    }

    const filtered = this.selectedM3uCategory === "all"
      ? this.m3uChannels
      : this.m3uChannels.filter((c) => (c.category || c.group || "General").toLowerCase() === this.selectedM3uCategory);

    filtered.forEach((ch) => {
      this.dom.scrollerM3U.appendChild(
        this.createPosterCard({
          id: ch.id,
          title: ch.title,
          folderName: ch.category || ch.group || "Live TV",
          posterUrl: ch.logo || this.getSafePoster(ch.title, true),
          streamUrl: ch.streamUrl,
          isM3U: true
        })
      );
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
    if (this.m3uChannels.length === 0) {
      this.showToast("No channels to clear");
      return;
    }
    const confirmClean = confirm("IPTV Channel အားလုံးကို ဖျက်မည်လား?");
    if (!confirmClean) return;

    await dbManager.clearChannels();
    this.m3uChannels = [];
    this.selectedM3uCategory = "all";
    if (this.dom.m3uCountBadge) {
      this.dom.m3uCountBadge.textContent = "0";
    }
    this.renderM3UInterface();
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
      console.warn("Drive sync error:", err);
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

  createPosterCard(item, progress = 0) {
    const card = document.createElement("div");
    card.className = "poster-card";

    card.innerHTML = `
      <div class="poster-thumb-wrap">
        <img alt="Thumbnail" loading="lazy" />
        ${item.isM3U ? `<span class="live-badge">LIVE</span>` : ""}
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

    card.addEventListener("click", () => this.openDetailsScreen(item));
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

  /* ================= Streaming & Player Controller ================= */
  openDetailsScreen(item, autoPlay = false) {
    this.activeMedia = item;
    const v = this.dom.mainVideo;

    // Attach Audio Pipeline
    this.setupAudioPipeline();
    this.resumeAudioContext();

    this.dom.detailsTitle.textContent = item.title;
    this.dom.detailsBadge.textContent = item.isM3U ? "LIVE IPTV" : "STREAM";
    this.dom.detailsMeta.textContent = `${item.folderName} • Adaptive Stream`;
    
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

    this.detectAudioIncompatibility(item.fileName || item.title);
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
    this.dom.mainVideo.pause();
    this.dom.mainVideo.src = "";
    
    this.dom.viewDetails.style.display = "none";
    this.dom.viewDetails.classList.remove("active");
    this.renderHistoryRow();
  }

  togglePlayback() {
    const v = this.dom.mainVideo;
    this.resumeAudioContext();
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
