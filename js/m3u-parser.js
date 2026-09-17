/**
 * Safe M3U Parser
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
          streamUrl: "",
          isM3U: true
        };
        
        const logoMatch = line.match(/tvg-logo=["']([^"']+)["']/i);
        if (logoMatch && logoMatch[1]) {
          currentChannel.logo = logoMatch[1].trim();
        }
        
        const groupMatch = line.match(/group-title=["']([^"']+)["']/i);
        if (groupMatch && groupMatch[1]) {
          currentChannel.group = this.sanitize(groupMatch[1]);
        }
        
        const commaIndex = line.lastIndexOf(",");
        if (commaIndex !== -1) {
          const rawTitle = line.substring(commaIndex + 1).trim();
          currentChannel.title = this.sanitize(rawTitle) || "Live Channel";
        }
        
        currentChannel.category = this.detectCategory(currentChannel.title, currentChannel.group);
      } else if (!line.startsWith("#")) {
        if (line.startsWith("http://") || line.startsWith("https://")) {
          const isWebPlatform = /youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com/i.test(line);
          
          if (!isWebPlatform) {
            if (currentChannel) {
              currentChannel.streamUrl = line;
              channels.push(currentChannel);
              currentChannel = null;
            } else {
              const urlPath = line.split("?")[0];
              const fallbackTitle = urlPath.substring(urlPath.lastIndexOf("/") + 1) || "Direct Stream";
              channels.push({
                id: "m3u-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
                title: this.sanitize(fallbackTitle),
                logo: "",
                group: "Direct Links",
                category: "General",
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
  
  static detectCategory(title, group) {
    const combined = `${title} ${group}`.toLowerCase();
    if (/sport|football|soccer|bein|espn|arena|sky sport|uefa|fifa|wwe|ufc|nba|racing|idman|cbc sport/i.test(combined)) {
      return "Sports";
    }
    if (/movie|cinema|film|action|hbo|netflix|box office|thriller|comedy|drama|cine/i.test(combined)) {
      return "Movies";
    }
    if (/news|cnn|bbc|al jazeera|sky news|fox|weather|bloomberg|cnbc/i.test(combined)) {
      return "News";
    }
    return group || "General";
  }
}
