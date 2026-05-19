// API configuration
//
// - Local dev: Vite → vercel dev on :3000
// - Vercel (same project): relative `/api/uat`
// - GitHub Pages: static only — calls Vercel API (see DEFAULT_VERCEL_API_ORIGIN)

/** Vercel deployment that hosts `/api/uat`. Update if your production URL changes. */
export const DEFAULT_VERCEL_API_ORIGIN = 'https://uat-scenarios-generator-cu34qa8q6.vercel.app';

export const API_CONFIG = {
  endpoint: '/api/uat',
  /** Timeout in milliseconds */
  timeout: 120000,
} as const;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isGitHubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

function resolveApiOrigin(): string {
  const fromEnv = import.meta.env.VITE_VERCEL_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  // GitHub Pages cannot run serverless routes; POST to same origin returns 405.
  if (isGitHubPagesHost()) {
    return DEFAULT_VERCEL_API_ORIGIN;
  }

  // Same-origin on Vercel (static + `api/` on one deployment).
  return '';
}

/**
 * Full URL for POST /api/uat (OpenAI scenario generation).
 */
export function getApiUrl(): string {
  if (import.meta.env.DEV) {
    return `http://localhost:3000${API_CONFIG.endpoint}`;
  }

  const origin = resolveApiOrigin();
  if (origin) {
    return `${origin}${API_CONFIG.endpoint}`;
  }

  return API_CONFIG.endpoint;
}
