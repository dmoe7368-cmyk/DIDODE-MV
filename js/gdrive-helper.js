/**
 * Google Drive Direct Stream & Image Helper
 */
export class GDriveHelper {
  /**
   * Google Drive ပေါ်ရှိ .PNG ပုံကို Direct Fetch လုပ်ရန် URL ထုတ်ပေးခြင်း
   */
  static getImageUrl(driveId, fallbackUrl) {
    if (!driveId || driveId.includes("sample")) {
      return fallbackUrl;
    }
    // Drive Thumbnail API ဖြင့် .PNG ကို တိုက်ရိုက် ဆွဲယူပြသခြင်း
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1280`;
  }
  
  /**
   * Google Drive ပေါ်ရှိ Video ကို Direct Stream လုပ်ရန် URL ထုတ်ပေးခြင်း
   */
  static getVideoUrl(driveId, fallbackUrl) {
    if (!driveId || driveId.includes("sample")) {
      return fallbackUrl;
    }
    // Google Drive direct export download stream
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }
}