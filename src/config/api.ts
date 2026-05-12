// API configuration
//
// - Local dev: Vite → vercel dev on :3000
// - Vercel (same project): use relative `/api/uat` so no env var is required
// - GitHub Pages: set VITE_VERCEL_API_URL at build time to your Vercel deployment origin

export const API_CONFIG = {
  endpoint: '/api/uat',
  /** Timeout in milliseconds */
  timeout: 120000,
} as const;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Full URL for POST /api/uat (OpenAI scenario generation).
 */
export function getApiUrl(): string {
  if (import.meta.env.DEV) {
    return `http://localhost:3000${API_CONFIG.endpoint}`;
  }

  const fromEnv = import.meta.env.VITE_VERCEL_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return `${trimTrailingSlash(fromEnv.trim())}${API_CONFIG.endpoint}`;
  }

  // Same-origin on Vercel (static + `api/` routes on one deployment)
  return API_CONFIG.endpoint;
}
