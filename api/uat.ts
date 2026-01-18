import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting (simple in-memory - resets on serverless function restart)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

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

// Validate and sanitize input
function validateInput(body: any): { valid: boolean; error?: string; data?: any } {
  if (!body || !Array.isArray(body.images)) {
    return { valid: false, error: 'Missing or invalid images array' };
  }
  
  if (body.images.length === 0) {
    return { valid: false, error: 'At least one image is required' };
  }
  
  if (body.images.length > 10) {
    return { valid: false, error: 'Maximum 10 images allowed' };
  }
  
  // Check total payload size (rough estimate: base64 is ~33% larger than binary)
  let totalSize = 0;
  for (const img of body.images) {
    if (!img.data || typeof img.data !== 'string') {
      return { valid: false, error: 'Invalid image data format' };
    }
    // Estimate: base64 string length / 1.33 * 3/4 (base64 encoding overhead)
    const estimatedSize = (img.data.length * 3) / 4;
    totalSize += estimatedSize;
  }
  
  const maxSizeMB = 20; // 20MB total
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (totalSize > maxSizeBytes) {
    return { valid: false, error: `Total image size exceeds ${maxSizeMB}MB limit` };
  }
  
  return { valid: true, data: body };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // CORS headers (allow your GitHub Pages domain)
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://yourusername.github.io', // Replace with your GitHub Pages URL
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Vercel dev
  ];
  
  if (allowedOrigins.includes(origin) || origin.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Rate limiting
  const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                   req.headers['x-real-ip']?.toString() || 
                   'unknown';
  
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.' 
    });
  }
  
  // Validate input
  const validation = validateInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  try {
    // Prepare images for OpenAI Vision API
    const imageContents = validation.data!.images.map((img: any, index: number) => ({
      type: 'image_url',
      image_url: {
        url: img.data.startsWith('data:') ? img.data : `data:image/${img.type || 'png'};base64,${img.data}`
      }
    }));
    
    // Build prompt
    const screenNames = validation.data!.images.map((img: any, i: number) => 
      img.name || `Screen ${i + 1}`
    );
    
    const prompt = `You are a QA expert analyzing UI screenshots to generate comprehensive User Acceptance Test (UAT) scenarios.

I'm providing ${imageContents.length} screenshot(s) in order: ${screenNames.join(', ')}.

For each screenshot, analyze:
1. Visible text, labels, buttons, form fields
2. UI elements (navigation, modals, tables, lists, toggles, etc.)
3. Visual hierarchy and layout
4. Error states, empty states, loading indicators if visible
5. Interactive elements and their relationships

Generate UAT scenarios as a plain text bullet list. Format requirements:
- Each scenario must start with [Screen N] where N is the screenshot number (1-based)
- For cross-screen flows, use [Flow] prefix
- Be specific and reference actual visible UI elements/text
- Include: validation, required fields, error handling, accessibility, responsiveness, edge cases
- Do NOT use generic placeholders - reference actual text/elements you see
- Keep each scenario to one line
- Separate scenarios with newlines

Example format:
[Screen 1] Verify "Login" button is visible and functional
[Screen 1] Verify email field accepts valid email format
[Screen 2] Verify "Submit" button is disabled when form is empty
[Flow] Verify navigation from Screen 1 to Screen 2 preserves form data

Now analyze the provided screenshots and generate comprehensive UAT scenarios:`;
    
    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // or 'gpt-4-turbo' if gpt-4o unavailable
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageContents
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ 
        error: 'Failed to generate scenarios. Please try again.' 
      });
    }
    
    const data = await openaiResponse.json();
    const scenariosText = data.choices[0]?.message?.content || '';
    
    if (!scenariosText) {
      return res.status(500).json({ error: 'No scenarios generated' });
    }
    
    // Parse scenarios into structured format
    const scenarios = scenariosText
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const trimmed = line.trim();
        const screenMatch = trimmed.match(/^\[Screen (\d+)\]/);
        const flowMatch = trimmed.match(/^\[Flow\]/);
        
        if (screenMatch) {
          return {
            screen: parseInt(screenMatch[1]),
            type: 'screen' as const,
            content: trimmed
          };
        } else if (flowMatch) {
          return {
            screen: 0,
            type: 'flow' as const,
            content: trimmed
          };
        } else {
          // Default to screen 1 if no label
          return {
            screen: 1,
            type: 'screen' as const,
            content: trimmed
          };
        }
      });
    
    return res.status(200).json({ scenarios });
    
  } catch (error: any) {
    console.error('Error processing request:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
