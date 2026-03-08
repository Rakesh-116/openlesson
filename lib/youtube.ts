// ============================================
// YOUTUBE URL UTILITIES
// Validation, extraction, and example videos for learning plan generation
// ============================================

/**
 * Regex to match various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - With or without additional query parameters
 */
const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&].*)?$/;

/**
 * Simpler regex for detecting if a string contains a YouTube URL
 */
const YOUTUBE_DETECT_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;

/**
 * Check if a string is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return YOUTUBE_REGEX.test(url.trim());
}

/**
 * Check if a string contains a YouTube URL (for auto-detection)
 */
export function containsYouTubeUrl(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return YOUTUBE_DETECT_REGEX.test(text);
}

/**
 * Extract the video ID from a YouTube URL
 * Returns null if the URL is invalid
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.trim().match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

/**
 * Normalize a YouTube URL to the standard watch format
 * Returns null if the URL is invalid
 */
export function normalizeYouTubeUrl(url: string): string | null {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Get the thumbnail URL for a YouTube video
 */
export function getYouTubeThumbnail(url: string, quality: "default" | "medium" | "high" | "maxres" = "medium"): string | null {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  
  const qualityMap = {
    default: "default",
    medium: "mqdefault",
    high: "hqdefault",
    maxres: "maxresdefault",
  };
  
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Get the embed URL for a YouTube video
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

// ============================================
// EXAMPLE EDUCATIONAL VIDEOS
// Curated list from top educational creators
// ============================================

export interface ExampleVideo {
  title: string;
  channel: string;
  url: string;
  videoId: string;
}

export const EXAMPLE_YOUTUBE_VIDEOS: ExampleVideo[] = [
  {
    title: "Essence of Linear Algebra",
    channel: "3Blue1Brown",
    url: "https://www.youtube.com/watch?v=fNk_zzaMoSs",
    videoId: "fNk_zzaMoSs",
  },
  {
    title: "How Electricity Actually Works",
    channel: "Veritasium",
    url: "https://www.youtube.com/watch?v=oI_X2cMHNe0",
    videoId: "oI_X2cMHNe0",
  },
  {
    title: "Quantum Computers Explained",
    channel: "Kurzgesagt",
    url: "https://www.youtube.com/watch?v=JhHMJCUmq28",
    videoId: "JhHMJCUmq28",
  },
];
