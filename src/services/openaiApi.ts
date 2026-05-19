import { getApiUrl } from '../config/api';
import { UATScenario, normalizeScenarioFromApi } from '../utils/scenarioGenerator';

export interface FigmaApiResponse {
  scenarios?: Record<string, unknown>[];
  error?: string;
}

/**
 * Call API to generate UAT scenarios from a Figma file link.
 */
export async function generateScenariosFromFigmaLink(figmaLink: string): Promise<UATScenario[]> {
  const apiUrl = getApiUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ figmaLink: figmaLink.trim() }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
      const rawMessage =
        (errorData?.error as string) ||
        (errorData?.message as string) ||
        `HTTP ${response.status}`;
      if (response.status === 405) {
        throw new Error(
          'HTTP 405: This site is static (GitHub Pages) and cannot run the API. Rebuild with VITE_VERCEL_API_URL pointing at your Vercel deployment, or use the Vercel app URL directly.'
        );
      }

      throw new Error(String(rawMessage).trim() || `Request failed (${response.status})`);
    }

    const data = (await response.json()) as FigmaApiResponse;

    if (data.error) {
      throw new Error(data.error);
    }

    const rawList = data.scenarios ?? [];
    return rawList.map((row) => normalizeScenarioFromApi(row, figmaLink.trim()));
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const err = error as { name?: string; message?: string };

    if (err.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }

    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const isDev = import.meta.env.DEV;
      if (isDev) {
        throw new Error('Cannot connect to API. Make sure "vercel dev" is running on port 3000.');
      }

      const apiUrl = getApiUrl();
      const onGitHubPages =
        typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

      if (onGitHubPages) {
        throw new Error(
          `Cannot reach the API at ${apiUrl}. Common causes: (1) Vercel Deployment Protection is ON — in Vercel go to Project → Settings → Deployment Protection and disable "Vercel Authentication" for Production, then redeploy; (2) wrong API URL — set GitHub secret VITE_VERCEL_API_URL to your public Vercel URL; (3) the API project is not deployed. You can also use the app directly on Vercel instead of GitHub Pages.`
        );
      }

      throw new Error(
        `Cannot connect to API at ${apiUrl}. If this project uses Vercel Deployment Protection, disable it for Production under Project → Settings → Deployment Protection.`
      );
    }

    if (err.message) {
      throw error;
    }

    throw new Error('Network error. Please check your connection.');
  }
}
