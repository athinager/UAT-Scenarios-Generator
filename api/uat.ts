import type { VercelRequest, VercelResponse } from '@vercel/node';

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const FIGMA_HOST = /figma\.com/i;

function validateFigmaLink(url: string): boolean {
  const t = url.trim();
  if (t.length < 10 || t.length > 2048) return false;
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    return FIGMA_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

function extractFigmaFileKey(url: string): string | null {
  try {
    const t = url.trim();
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'design' || p === 'file' || p === 'proto');
    if (idx >= 0 && parts[idx + 1] && /^[a-zA-Z0-9]+$/.test(parts[idx + 1])) {
      return parts[idx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

function collectFigmaNodeNames(node: any, depth: number, maxDepth: number, out: string[]): void {
  if (!node || depth > maxDepth) return;
  const t = node.type as string;
  if (
    (t === 'FRAME' ||
      t === 'COMPONENT' ||
      t === 'INSTANCE' ||
      t === 'PAGE' ||
      t === 'SECTION' ||
      t === 'CANVAS') &&
    node.name &&
    typeof node.name === 'string'
  ) {
    const prefix = t === 'PAGE' || t === 'CANVAS' ? 'Page' : t;
    out.push(`${prefix}: ${node.name}`);
    if (out.length >= 120) return;
  }
  const children = node.children as any[] | undefined;
  if (children && depth < maxDepth) {
    for (const c of children) {
      collectFigmaNodeNames(c, depth + 1, maxDepth, out);
      if (out.length >= 120) return;
    }
  }
}

async function fetchFigmaDesignSummary(fileKey: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
      headers: { 'X-Figma-Token': token },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { document?: { name?: string; children?: any[] } };
    const fileName = data.document?.name ?? 'Untitled';
    const names: string[] = [];
    collectFigmaNodeNames(data.document, 0, 4, names);
    const unique = [...new Set(names)].slice(0, 80);
    const summary = [
      `Figma file name: ${fileName}`,
      unique.length ? `Frames / components / pages referenced: ${unique.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return summary.slice(0, 12000);
  } catch {
    return null;
  }
}

function validateInput(body: any): { valid: boolean; error?: string; figmaLink?: string } {
  if (!body || typeof body.figmaLink !== 'string') {
    return { valid: false, error: 'Missing or invalid figmaLink' };
  }
  const figmaLink = body.figmaLink.trim();
  if (!validateFigmaLink(figmaLink)) {
    return { valid: false, error: 'Please provide a valid Figma URL (figma.com design or file link)' };
  }
  return { valid: true, figmaLink };
}

interface GeneratedScenarioPayload {
  name: string;
  flowOrScreen: string;
  description: string;
  steps: string[];
  expectedResult: string;
}

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function openAiUpstreamMessage(errorData: unknown): string {
  const e = errorData as { error?: { message?: string }; message?: string };
  return e?.error?.message || e?.message || '';
}

/** Billing / hard quota — retrying will not help. */
function isInsufficientQuotaMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    msg.includes('insufficient_quota') ||
    m.includes('exceeded your current quota') ||
    m.includes('billing hard limit') ||
    m.includes('no payment method')
  );
}

/**
 * One retry after a short wait when 429 is a soft rate limit (not billing/quota).
 */
async function postOpenAiChatCompletion(
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };

  let res = await fetch(OPENAI_CHAT_URL, init);
  if (res.status !== 429) {
    return res;
  }

  let errJson: unknown = {};
  try {
    errJson = await res.clone().json();
  } catch {
    /* ignore */
  }
  const msg = openAiUpstreamMessage(errJson);
  if (isInsufficientQuotaMessage(msg)) {
    return res;
  }

  await new Promise((r) => setTimeout(r, 4500));
  return fetch(OPENAI_CHAT_URL, init);
}

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return false;
  const allowed = new Set([
    'https://athgeronatsiou-creator.github.io',
    'https://athgeronatsiou-creator.github.io/UAT-Scenarios-Generator',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
  ]);
  if (allowed.has(origin)) return true;
  if (origin.includes('localhost') && origin.includes('http://')) return true;
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) return true;
    if (u.protocol === 'https:' && u.hostname.endsWith('github.io')) return true;
  } catch {
    /* invalid */
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';

  if (isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIP =
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.headers['x-real-ip']?.toString() ||
    'unknown';

  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
    });
  }

  const validation = validateInput(req.body);
  if (!validation.valid || !validation.figmaLink) {
    return res.status(400).json({ error: validation.error });
  }

  const figmaLink = validation.figmaLink;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
  const fileKey = extractFigmaFileKey(figmaLink);
  let designContext = '';
  if (figmaToken && fileKey) {
    const summary = await fetchFigmaDesignSummary(fileKey, figmaToken);
    if (summary) {
      designContext = `\n\n--- Design structure from Figma API (for reference) ---\n${summary}\n`;
    }
  } else if (!figmaToken && fileKey) {
    designContext = `\n\nNote: FIGMA_ACCESS_TOKEN is not configured on the server. Infer scenarios from the link and common UX patterns; still anchor expected results to what a reviewer would verify against this file.\n`;
  }

  const templateRule = `Every scenario "description" MUST follow this exact pattern (fill the three slots with concrete detail):
Verify that [action/selection], correctly [expected system response], in/on the [affected area/component].

- [action/selection] = what the user does or triggers
- [expected system response] = what the system should do in reaction
- [affected area/component] = where the outcome is visible or measurable`;

  const jsonInstruction = `Return a single JSON object with exactly one key "scenarios", whose value is an array of objects. Each object MUST have these keys:
- "name": short scenario title
- "flowOrScreen": a tag such as a screen name or "Flow: Checkout"
- "description": one sentence following the template above (must start with "Verify that ")
- "steps": array of strings, ordered test steps (at least 2 steps when possible)
- "expectedResult": paragraph describing what should be observed in the product when compared to the designs at the Figma link

Produce at least 8 scenarios covering navigation, forms, validation, primary flows, empty/error states, and accessibility where relevant. Use terminology consistent with the design summary or typical patterns for this product area.`;

  const prompt = `You are a QA lead creating User Acceptance Test scenarios for UI that is specified in Figma.

Figma link (authoritative reference for reviewers): ${figmaLink}
${designContext}

${templateRule}

${jsonInstruction}`;

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const maxOutRaw = parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '4096', 10);
  const max_tokens = Math.min(Math.max(Number.isFinite(maxOutRaw) ? maxOutRaw : 4096, 1024), 8192);

  const requestBody: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens,
    temperature: 0.45,
    response_format: { type: 'json_object' },
  };

  try {
    const openaiResponse = await postOpenAiChatCompletion(apiKey, requestBody);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({} as any));
      const upstreamStatus = openaiResponse.status;
      const upstreamMessage =
        errorData?.error?.message || errorData?.message || `Upstream AI provider error (HTTP ${upstreamStatus})`;

      console.error('OpenAI API error:', { upstreamStatus, errorData, model });

      if (upstreamStatus === 429) {
        const quota =
          isInsufficientQuotaMessage(upstreamMessage) ||
          upstreamMessage.toLowerCase().includes('insufficient_quota');
        return res.status(429).json({
          error: quota
            ? 'OpenAI usage limit reached or billing required. Add a payment method at https://platform.openai.com/settings/organization/billing (or buy credits), or set OPENAI_API_KEY in Vercel to a key from an account with available quota.'
            : 'AI rate limit exceeded. Wait a minute and try again.',
        });
      }

      if (upstreamStatus === 401 || upstreamStatus === 403) {
        return res.status(500).json({
          error: 'AI authentication failed. Verify `OPENAI_API_KEY` is set correctly in Vercel.',
        });
      }

      return res.status(500).json({
        error: 'Failed to generate scenarios. Please try again.',
      });
    }

    const data = await openaiResponse.json();
    const rawContent = data.choices[0]?.message?.content || '';

    let parsed: { scenarios?: GeneratedScenarioPayload[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    const list = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
    if (list.length === 0) {
      return res.status(500).json({ error: 'No scenarios generated' });
    }

    const scenarios = list.map((s) => ({
      name: String(s.name ?? '').trim(),
      flowOrScreen: String(s.flowOrScreen ?? '').trim(),
      description: String(s.description ?? '').trim(),
      steps: Array.isArray(s.steps) ? s.steps.map((x) => String(x)) : [],
      expectedResult: String(s.expectedResult ?? '').trim(),
      figmaLink,
    }));

    return res.status(200).json({ scenarios });
  } catch (error: any) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}
