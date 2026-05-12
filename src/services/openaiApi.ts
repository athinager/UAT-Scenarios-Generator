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

      const normalized = String(rawMessage);
      const normalizedLower = normalized.toLowerCase();
      const isQuota =
        response.status === 429 &&
        (normalizedLower.includes('quota') ||
          normalizedLower.includes('insufficient_quota') ||
          normalizedLower.includes('resource_exhausted'));

      if (isQuota) {
        throw new Error(
          'AI quota exceeded. Check your AI provider plan/billing (or switch API key), then try again.'
        );
      }

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a bit and try again.');
      }

      throw new Error(normalized || 'Failed to generate scenarios');
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
      throw new Error('Cannot connect to API. Please check your internet connection.');
    }

    if (err.message) {
      throw error;
    }

    throw new Error('Network error. Please check your connection.');
  }
}
