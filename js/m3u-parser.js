/**
 * Production-Ready M3U Playlist Parser
 * Upgraded: High-Precision Sports & Genre Recognition Regex Engine
 */
export class M3UParser {
  static parse(rawContent) {
    if (!rawContent || typeof rawContent !== "string") return [];
    
    let cleanText = rawContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = cleanText.split("\n");
    const channels = [];
    let currentChannel = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === "#EXTM3U") continue;
      
      if (line.startsWith("#EXTINF:")) {
        currentChannel = {
          id: "m3u-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
          title: "Live Channel",
          logo: "",
          group: "General",
          category: "General",
          isSports: false,
          streamUrl: "",
          isM3U: true
        };
        
        // 1. Logo Extraction
        const logoMatch = line.match(/tvg-logo=["']([^"']+)["']/i);
        if (logoMatch && logoMatch[1]) currentChannel.logo = logoMatch[1].trim();
        
        // 2. Group Title Extraction
        const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
        if (groupMatch && groupMatch[1]) {
          currentChannel.group = this.sanitize(groupMatch[1]);
        }
        
        // 3. Channel Name Extraction
        const commaIndex = line.lastIndexOf(",");
        if (commaIndex !== -1) {
          const rawTitle = line.substring(commaIndex + 1).trim();
          currentChannel.title = this.sanitize(rawTitle) || "Live Channel";
        }
        
        // 4. Detailed Categorization
        const detected = this.detectCategory(currentChannel.title, currentChannel.group);
        currentChannel.category = detected.category;
        currentChannel.isSports = detected.isSports;
        
        // Group ထဲတွင် Sports ဟု မပါလျှင်ပင် Auto Classified Group အဖြစ် သတ်မှတ်ခြင်း
        if (currentChannel.isSports && (!currentChannel.group || currentChannel.group.toLowerCase() === "general")) {
          currentChannel.group = "Sports";
        }
      } else if (!line.startsWith("#")) {
        if (line.startsWith("http://") || line.startsWith("https://")) {
          // Exclude direct webpage video wrappers
          const isWebPlatform = /youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com/i.test(line);
          if (!isWebPlatform) {
            if (currentChannel) {
              currentChannel.streamUrl = line;
              channels.push(currentChannel);
              currentChannel = null;
            } else {
              const urlPath = line.split("?")[0];
              const fallbackTitle = urlPath.substring(urlPath.lastIndexOf("/") + 1) || "Direct Stream";
              const detected = this.detectCategory(fallbackTitle, "Direct Links");
              channels.push({
                id: "m3u-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
                title: this.sanitize(fallbackTitle),
                logo: "",
                group: detected.isSports ? "Sports" : "Direct Links",
                category: detected.category,
                isSports: detected.isSports,
                streamUrl: line,
                isM3U: true
              });
            }
          } else {
            currentChannel = null;
          }
        }
      }
    }
    
    return channels;
  }
  
  static sanitize(str) {
    if (!str) return "";
    return str
      .replace(/<[^>]*>/g, "")
      .replace(/alt=["'][^"']*["']/gi, "")
      .replace(/loading=["'][^"']*["']/gi, "")
      .replace(/[\\/"'<>]/g, "")
      .trim();
  }
  
  /**
   * Universal Sports & Genre Recognition Matrix
   */
  static detectCategory(title, group) {
    const combined = `${title} ${group}`.toLowerCase();
    
    // Comprehensive Sports Detection Regex
    const sportsRegex = /\b(sport|sports|football|soccer|bein|espn|arena|sky sport|uefa|fifa|wwe|ufc|nba|racing|idman|cbc sport|cricket|tennis|golf|f1|formula|motorsport|motogp|hockey|baseball|rugby|atg live|super sport|polsat sport|bt sport|dazn|eurosport|match!|матч|kosmos|snooker|fight|boxing)\b/i;
    
    if (sportsRegex.test(combined)) {
      return { category: "Sports", isSports: true };
    }
    
    if (/movie|cinema|film|action|hbo|netflix|box office|thriller|comedy|drama|cine|premiere/i.test(combined)) {
      return { category: "Movies", isSports: false };
    }
    
    if (/news|cnn|bbc|al jazeera|sky news|fox|weather|bloomberg|cnbc|haber|tagesschau|24h|euronews/i.test(combined)) {
      return { category: "News", isSports: false };
    }
    
    if (/anime|animation|cartoon|kids|disney|nick|plusplus|kika|cbbc|cbeebies/i.test(combined)) {
      return { category: "Anime & Kids", isSports: false };
    }
    
    return { category: group || "General", isSports: false };
  }
}
