/**
 * Production-Ready M3U Playlist Parser
 * Fixes: Strips unescaped HTML tag leaks in titles and auto-categorizes channels.
 */
export class M3UParser {
  static parse(rawText) {
    const lines = rawText.split(/\r?\n/);
    const channels = [];
    let currentChannel = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      if (line.startsWith("#EXTINF:")) {
        currentChannel = {
          id: "m3u-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
          title: "Channel",
          logo: "",
          group: "General",
          streamUrl: "",
          isM3U: true
        };
        
        // 1. Extract Logo
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        if (logoMatch && logoMatch[1]) {
          currentChannel.logo = logoMatch[1].trim();
        }
        
        // 2. Extract Group Title
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch && groupMatch[1]) {
          currentChannel.group = this.cleanText(groupMatch[1]);
        }
        
        // 3. Extract Raw Title after the comma
        const commaIdx = line.indexOf(",");
        if (commaIdx !== -1) {
          const rawTitle = line.substring(commaIdx + 1).trim();
          currentChannel.title = this.cleanText(rawTitle);
        }
        
        // 4. Auto Categorize (Sports, Movies, News, Entertainment)
        currentChannel.category = this.detectCategory(currentChannel.title, currentChannel.group);
        
      } else if (!line.startsWith("#") && (line.startsWith("http://") || line.startsWith("https://"))) {
        if (currentChannel) {
          currentChannel.streamUrl = line;
          channels.push(currentChannel);
          currentChannel = null;
        } else {
          const rawTitle = line.substring(line.lastIndexOf("/") + 1).split("?")[0] || "Live Stream";
          channels.push({
            id: "m3u-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
            title: this.cleanText(rawTitle),
            logo: "",
            group: "Direct Links",
            category: "General",
            streamUrl: line,
            isM3U: true
          });
        }
      }
    }
    
    return channels;
  }
  
  /**
   * HTML Tag များ၊ `alt=` စာသားများနှင့် သင်္ကေတ အပိုများကို ဖယ်ရှားပေးသော Sanitizer
   */
  static cleanText(str) {
    if (!str) return "";
    return str
      .replace(/<[^>]*>/g, "") // HTML tags ဖျက်ခြင်း
      .replace(/alt=["'][^"']*["']/gi, "") // alt="" attributes ဖျက်ခြင်း
      .replace(/loading=["'][^"']*["']/gi, "") // loading="" attributes ဖျက်ခြင်း
      .replace(/[\\/"'<>]/g, "") // အပို Special characters ဖျက်ခြင်း
      .trim();
  }
  
  /**
   * အမည်နှင့် Group ကို ကြည့်၍ Category အလိုအလျောက် သတ်မှတ်ပေးခြင်း
   */
  static detectCategory(title, group) {
    const text = `${title} ${group}`.toLowerCase();
    
    if (/sport|football|soccer|bein|espn|arena|sky sport|uefa|fifa|wwe|ufc|nba|cricket|tennis/i.test(text)) {
      return "Sports";
    }
    if (/movie|cinema|film|action|hbo|netflix|box office|thriller|comedy|drama/i.test(text)) {
      return "Movies";
    }
    if (/news|cnn|bbc|al jazeera|sky news|fox|weather|bloomberg|cnbc/i.test(text)) {
      return "News";
    }
    if (/anime|animation|cartoon|kids|disney|nick/i.test(text)) {
      return "Anime & Kids";
    }
    return group || "General";
  }
}