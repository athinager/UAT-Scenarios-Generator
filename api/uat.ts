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

type AiProvider = 'openai' | 'gemini';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function resolveProvider(): AiProvider | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'openai') return explicit;
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

function upstreamErrorMessage(errorData: unknown): string {
  const e = errorData as {
    error?: { message?: string; status?: string };
    message?: string;
  };
  return e?.error?.message || e?.message || '';
}

/** Billing / hard quota — retrying will not help. */
function isInsufficientQuotaMessage(msg: string, provider: AiProvider): boolean {
  const m = msg.toLowerCase();
  if (provider === 'openai') {
    return (
      msg.includes('insufficient_quota') ||
      m.includes('exceeded your current quota') ||
      m.includes('billing hard limit') ||
      m.includes('no payment method')
    );
  }
  return (
    m.includes('resource_exhausted') ||
    m.includes('quota exceeded') ||
    m.includes('exceeded your current quota') ||
    m.includes('billing')
  );
}

async function fetchWith429Retry(
  url: string,
  init: RequestInit,
  provider: AiProvider
): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status !== 429) return res;

  let errJson: unknown = {};
  try {
    errJson = await res.clone().json();
  } catch {
    /* ignore */
  }
  if (isInsufficientQuotaMessage(upstreamErrorMessage(errJson), provider)) {
    return res;
  }

  await new Promise((r) => setTimeout(r, 4500));
  return fetch(url, init);
}

async function callOpenAi(prompt: string): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 500, message: 'OPENAI_API_KEY is not configured.' };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const maxOutRaw = parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '4096', 10);
  const max_tokens = Math.min(Math.max(Number.isFinite(maxOutRaw) ? maxOutRaw : 4096, 1024), 8192);

  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens,
    temperature: 0.45,
    response_format: { type: 'json_object' },
  };

  const res = await fetchWith429Retry(
    OPENAI_CHAT_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    'openai'
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      upstreamErrorMessage(errorData) || `OpenAI error (HTTP ${res.status})`;
    console.error('OpenAI API error:', { status: res.status, errorData, model });
    return { ok: false, status: res.status, message };
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content || '';
  return { ok: true, text };
}

async function callGemini(prompt: string): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 500, message: 'GEMINI_API_KEY is not configured.' };
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const maxOutRaw = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '4096', 10);
  const maxOutputTokens = Math.min(
    Math.max(Number.isFinite(maxOutRaw) ? maxOutRaw : 4096, 1024),
    8192
  );

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.45,
      maxOutputTokens,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetchWith429Retry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'gemini'
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      upstreamErrorMessage(errorData) || `Gemini error (HTTP ${res.status})`;
    console.error('Gemini API error:', { status: res.status, errorData, model });
    return { ok: false, status: res.status, message };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, text };
}

function mapAiError(status: number, message: string, provider: AiProvider): string {
  if (status === 429) {
    const quota = isInsufficientQuotaMessage(message, provider);
    if (provider === 'gemini') {
      return quota
        ? 'Gemini quota exceeded. Check usage at https://aistudio.google.com/ or enable billing in Google AI Studio, or set GEMINI_API_KEY in Vercel to a key with available quota.'
        : 'Gemini rate limit exceeded. Wait a minute and try again.';
    }
    return quota
      ? 'OpenAI usage limit reached or billing required. Add a payment method at https://platform.openai.com/settings/organization/billing (or buy credits), or set OPENAI_API_KEY in Vercel to a key with available quota.'
      : 'AI rate limit exceeded. Wait a minute and try again.';
  }

  if (status === 401 || status === 403) {
    return provider === 'gemini'
      ? 'Gemini authentication failed. Verify GEMINI_API_KEY is set correctly in Vercel (create one at https://aistudio.google.com/apikey).'
      : 'AI authentication failed. Verify OPENAI_API_KEY is set correctly in Vercel.';
  }

  return message || 'Failed to generate scenarios. Please try again.';
}

function parseScenariosJson(
  rawContent: string,
  figmaLink: string
): { ok: true; scenarios: ReturnType<typeof formatScenarios> } | { ok: false; error: string } {
  let parsed: { scenarios?: GeneratedScenarioPayload[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { ok: false, error: 'Invalid AI response format' };
  }

  const list = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  if (list.length === 0) {
    return { ok: false, error: 'No scenarios generated' };
  }

  return { ok: true, scenarios: formatScenarios(list, figmaLink) };
}

function formatScenarios(list: GeneratedScenarioPayload[], figmaLink: string) {
  return list.map((s) => ({
    name: String(s.name ?? '').trim(),
    flowOrScreen: String(s.flowOrScreen ?? '').trim(),
    description: String(s.description ?? '').trim(),
    steps: Array.isArray(s.steps) ? s.steps.map((x) => String(x)) : [],
    expectedResult: String(s.expectedResult ?? '').trim(),
    figmaLink,
  }));
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
  const provider = resolveProvider();
  if (!provider) {
    console.error('No AI provider configured');
    return res.status(500).json({
      error:
        'Server configuration error: set GEMINI_API_KEY (recommended) or OPENAI_API_KEY in Vercel, optionally AI_PROVIDER=gemini|openai.',
    });
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

  try {
    const aiResult =
      provider === 'gemini' ? await callGemini(prompt) : await callOpenAi(prompt);

    if (!aiResult.ok) {
      const clientMessage = mapAiError(aiResult.status, aiResult.message, provider);
      const httpStatus = aiResult.status === 429 ? 429 : 500;
      return res.status(httpStatus).json({ error: clientMessage });
    }

    const parsed = parseScenariosJson(aiResult.text, figmaLink);
    if (!parsed.ok) {
      return res.status(500).json({ error: parsed.error });
    }

    return res.status(200).json({ scenarios: parsed.scenarios });
  } catch (error: any) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}
