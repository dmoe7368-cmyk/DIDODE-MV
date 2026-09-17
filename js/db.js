/**
 * Unified IndexedDB Database for Device Media and M3U Playlists
 */
const DB_NAME = "DidodeUnifiedDB_v3";
const DB_VERSION = 1;
const VIDEO_STORE = "uploaded_videos";
const M3U_STORE = "m3u_channels";

class DatabaseManager {
  constructor() {
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(VIDEO_STORE)) {
          db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(M3U_STORE)) {
          db.createObjectStore(M3U_STORE, { keyPath: "id" });
        }
      };
      
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      
      request.onerror = (e) => reject(e.target.error);
    });
  }
  
  async saveVideo(videoItem) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VIDEO_STORE], "readwrite");
      const store = tx.objectStore(VIDEO_STORE);
      const req = store.put(videoItem);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
  
  async getAllVideos() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VIDEO_STORE], "readonly");
      const store = tx.objectStore(VIDEO_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  
  async clearVideos() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([VIDEO_STORE], "readwrite");
      const store = tx.objectStore(VIDEO_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
  
  async saveChannels(channelList) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([M3U_STORE], "readwrite");
      const store = tx.objectStore(M3U_STORE);
      channelList.forEach((ch) => store.put(ch));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  
  async getAllChannels() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([M3U_STORE], "readonly");
      const store = tx.objectStore(M3U_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  
  async clearChannels() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([M3U_STORE], "readwrite");
      const store = tx.objectStore(M3U_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}

export const dbManager = new DatabaseManager();
