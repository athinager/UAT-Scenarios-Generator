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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://athgeronatsiou-creator.github.io',
    'https://athgeronatsiou-creator.github.io/UAT-Scenarios-Generator',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
  ];

  if (allowedOrigins.includes(origin) || (origin.includes('localhost') && origin.includes('http://'))) {
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

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 6000,
        temperature: 0.45,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({} as any));
      const upstreamStatus = openaiResponse.status;
      const upstreamMessage =
        errorData?.error?.message || errorData?.message || `Upstream AI provider error (HTTP ${upstreamStatus})`;

      console.error('OpenAI API error:', { upstreamStatus, errorData });

      if (upstreamStatus === 429) {
        return res.status(429).json({
          error:
            upstreamMessage.includes('insufficient_quota') ||
            upstreamMessage.toLowerCase().includes('quota')
              ? 'AI quota exceeded. Check your OpenAI plan/billing or use a different API key.'
              : 'AI rate limit exceeded. Please wait a bit and try again.',
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
