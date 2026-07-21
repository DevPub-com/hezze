const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * @param {string} input
 * @returns {string | null}
 */
export function extractYoutubeVideoId(input) {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate = null;

    if (hostname === "youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      candidate = url.searchParams.get("v");
      if (!candidate) {
        const [route, id] = url.pathname.split("/").filter(Boolean);
        if (["live", "shorts", "embed", "v"].includes(route)) candidate = id || null;
      }
    }

    return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
