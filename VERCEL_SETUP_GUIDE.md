# Step-by-Step Guide: Adding OpenAI Vision API via Vercel

## Step 0: Repo Inspection & Plan

### What I Found in Your Repo:

**Framework & Build:**
- ✅ **Vite** (build tool) + **React 18** + **TypeScript**
- ✅ Builds to `dist/` folder for GitHub Pages
- ✅ Currently uses **tesseract.js** for client-side OCR (we'll keep as fallback)
- ✅ No backend currently - everything runs in browser

**Key Files:**
- `src/components/ScenarioGenerator.tsx` - Currently analyzes images and generates scenarios
- `src/utils/imageAnalysis.ts` - OCR and UI detection (client-side)
- `src/utils/scenarioGenerator.ts` - Generates UAT scenarios from analysis
- `vite.config.ts` - Build configuration

**Where Changes Go:**
1. **New folder:** `api/uat.ts` - Vercel serverless function
2. **Update:** `src/components/ScenarioGenerator.tsx` - Add API call option
3. **New file:** `.env.local` - Local dev environment (gitignored)
4. **Update:** `package.json` - Add Vercel CLI for local testing

**Architecture Plan:**
```
Frontend (GitHub Pages)
  ↓ POST images (base64)
Vercel Serverless Function (/api/uat)
  ↓ Calls OpenAI Vision API
OpenAI GPT-4 Vision
  ↓ Returns scenarios
Frontend displays results
```

---

## Step 1: Create Vercel Account + Connect GitHub Repo

### 1.1 Create Vercel Account
1. Go to https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended - easier to connect repo)
4. Authorize Vercel to access your GitHub account

### 1.2 Import Your Repository
1. After signing in, you'll see the Vercel dashboard
2. Click **"Add New..."** → **"Project"**
3. You'll see a list of your GitHub repositories
4. Find **"UAT Scenarios Generator"** (or your repo name)
5. Click **"Import"** next to it

### 1.3 Configure Project (Important Settings)
On the import screen:
- **Framework Preset:** Select **"Other"** or **"Vite"** (Vercel auto-detects)
- **Root Directory:** Leave as `./` (root of repo)
- **Build Command:** `npm run build` (already in your package.json)
- **Output Directory:** `dist` (matches your vite.config.ts)
- **Install Command:** `npm install`

**⚠️ IMPORTANT:** 
- **DO NOT** click "Deploy" yet - we need to add the API function first
- Click **"Cancel"** or close the window for now
- We'll deploy after adding the API code

**✅ Success Check:** You should see your repo listed in Vercel dashboard (even if not deployed yet)

---

## Step 2: Add Vercel Serverless Function

### 2.1 Create API Directory
In your project root (same level as `src/`), create a new folder:

```bash
mkdir api
```

### 2.2 Create the Serverless Function
Create file: `api/uat.ts`

**Copy this exact code:**

```typescript
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
```

**✅ Success Check:** 
- File `api/uat.ts` exists in your project root
- No TypeScript errors (we'll install types next)

### 2.3 Install Vercel Types
Add Vercel types to your project:

```bash
npm install --save-dev @vercel/node
```

**✅ Success Check:** `package.json` should show `@vercel/node` in `devDependencies`

---

## Step 3: Add Environment Variable in Vercel

### 3.1 Get OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click **"Create new secret key"**
4. Name it (e.g., "UAT Scenarios Generator")
5. **⚠️ COPY THE KEY IMMEDIATELY** - you won't see it again
6. Save it somewhere safe (password manager)

### 3.2 Add to Vercel
1. Go to your Vercel dashboard
2. Click on your project (or create it if you haven't)
3. Go to **Settings** tab
4. Click **Environment Variables** in left sidebar
5. Click **"Add New"**
6. Fill in:
   - **Key:** `OPENAI_API_KEY`
   - **Value:** (paste your OpenAI API key)
   - **Environment:** Select **Production**, **Preview**, and **Development** (all three)
7. Click **"Save"**

**✅ Success Check:** 
- `OPENAI_API_KEY` appears in your environment variables list
- It shows for all three environments (Production, Preview, Development)

### 3.3 Create Local Environment File (for testing)
Create `.env.local` in your project root:

```bash
OPENAI_API_KEY=your_actual_key_here
```

**⚠️ IMPORTANT:** 
- Add `.env.local` to `.gitignore` (it should already be there)
- Never commit this file to GitHub

**✅ Success Check:** `.env.local` exists and is in `.gitignore`

---

## Step 4: Update Frontend to Call API

### 4.1 Create API Config File
Create `src/config/api.ts`:

```typescript
// API configuration
export const API_CONFIG = {
  // In development, use local Vercel dev server
  // In production, use your Vercel deployment URL
  baseURL: import.meta.env.DEV 
    ? 'http://localhost:3000'  // Vercel dev runs on 3000
    : import.meta.env.VITE_VERCEL_API_URL || 'https://your-project.vercel.app',
  
  endpoint: '/api/uat',
  
  // Timeout in milliseconds
  timeout: 60000, // 60 seconds (OpenAI can be slow)
};

export function getApiUrl(): string {
  return `${API_CONFIG.baseURL}${API_CONFIG.endpoint}`;
}
```

### 4.2 Create API Service
Create `src/services/openaiApi.ts`:

```typescript
import { getApiUrl } from '../config/api';
import { Scenario } from '../utils/scenarioGenerator';

export interface ApiImage {
  data: string; // base64 encoded
  name: string;
  type?: string; // 'png', 'jpg', 'webp'
  index: number;
}

export interface ApiResponse {
  scenarios: Scenario[];
  error?: string;
}

/**
 * Convert File to base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Call Vercel API to generate scenarios using OpenAI Vision
 */
export async function generateScenariosWithOpenAI(
  images: Array<{ file: File; name: string; index: number }>
): Promise<Scenario[]> {
  const apiUrl = getApiUrl();
  
  // Convert images to base64
  const apiImages: ApiImage[] = await Promise.all(
    images.map(async (img) => {
      const base64 = await fileToBase64(img.file);
      const type = img.file.type.split('/')[1] || 'png';
      return {
        data: base64,
        name: img.name,
        type,
        index: img.index,
      };
    })
  );
  
  // Call API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images: apiImages }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}` 
      }));
      throw new Error(errorData.error || 'Failed to generate scenarios');
    }
    
    const data: ApiResponse = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.scenarios || [];
    
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
    
    if (error.message) {
      throw error;
    }
    
    throw new Error('Network error. Please check your connection.');
  }
}
```

### 4.3 Update ScenarioGenerator Component
Update `src/components/ScenarioGenerator.tsx`:

**Find this section (around line 18-50):**

```typescript
  useEffect(() => {
    if (images.length === 0) {
      setAnalyses([]);
      setScenarios([]);
      return;
    }

    const analyzeImages = async () => {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      const newAnalyses: ImageAnalysis[] = [];
      
      for (let i = 0; i < images.length; i++) {
        try {
          const analysis = await analyzeImage(images[i].file);
          newAnalyses.push(analysis);
          setAnalysisProgress(((i + 1) / images.length) * 100);
        } catch (error) {
          console.error(`Failed to analyze image ${i + 1}:`, error);
          newAnalyses.push({ text: '', elements: [] });
        }
      }
      
      setAnalyses(newAnalyses);
      const generatedScenarios = generateScenarios(images, newAnalyses);
      setScenarios(generatedScenarios);
      setIsAnalyzing(false);
      onCopy(`Generated ${generatedScenarios.length} UAT scenarios`, 'success');
    };

    analyzeImages();
  }, [images, onCopy]);
```

**Replace with:**

```typescript
  const [useOpenAI, setUseOpenAI] = useState(true); // Toggle between OpenAI and local

  useEffect(() => {
    if (images.length === 0) {
      setAnalyses([]);
      setScenarios([]);
      return;
    }

    const analyzeImages = async () => {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      try {
        if (useOpenAI) {
          // Use OpenAI Vision API via Vercel
          setAnalysisProgress(10);
          
          const { generateScenariosWithOpenAI } = await import('../services/openaiApi');
          
          const apiImages = images.map((img, idx) => ({
            file: img.file,
            name: img.name,
            index: idx,
          }));
          
          setAnalysisProgress(30);
          const generatedScenarios = await generateScenariosWithOpenAI(apiImages);
          setAnalysisProgress(100);
          
          setScenarios(generatedScenarios);
          setIsAnalyzing(false);
          onCopy(`Generated ${generatedScenarios.length} UAT scenarios using AI`, 'success');
        } else {
          // Fallback to local analysis
          const newAnalyses: ImageAnalysis[] = [];
          
          for (let i = 0; i < images.length; i++) {
            try {
              const analysis = await analyzeImage(images[i].file);
              newAnalyses.push(analysis);
              setAnalysisProgress(((i + 1) / images.length) * 80 + 10);
            } catch (error) {
              console.error(`Failed to analyze image ${i + 1}:`, error);
              newAnalyses.push({ text: '', elements: [] });
            }
          }
          
          setAnalyses(newAnalyses);
          const generatedScenarios = generateScenarios(images, newAnalyses);
          setScenarios(generatedScenarios);
          setIsAnalyzing(false);
          onCopy(`Generated ${generatedScenarios.length} UAT scenarios`, 'success');
        }
      } catch (error: any) {
        console.error('Analysis failed:', error);
        setIsAnalyzing(false);
        onCopy(error.message || 'Failed to generate scenarios', 'error');
        
        // Fallback to local if OpenAI fails
        if (useOpenAI) {
          onCopy('Falling back to local analysis...', 'info');
          setUseOpenAI(false);
          // Retry with local
          setTimeout(() => {
            analyzeImages();
          }, 1000);
        }
      }
    };

    analyzeImages();
  }, [images, useOpenAI, onCopy]);
```

**✅ Success Check:**
- No TypeScript errors
- Files created: `src/config/api.ts`, `src/services/openaiApi.ts`
- `ScenarioGenerator.tsx` updated

---

## Step 5: Local Testing

### 5.1 Install Vercel CLI
```bash
npm install -g vercel
```

Or use npx (no global install):
```bash
npx vercel@latest
```

### 5.2 Login to Vercel
```bash
vercel login
```
Follow the prompts to authenticate.

### 5.3 Link Project (Optional but Recommended)
```bash
vercel link
```
- Select your project if it exists
- Or create new project
- This creates `.vercel` folder (add to `.gitignore`)

### 5.4 Run Local Dev Server
```bash
vercel dev
```

This will:
- Start Vercel dev server on `http://localhost:3000`
- Run your API function at `http://localhost:3000/api/uat`
- Watch for changes

### 5.5 Test the API Endpoint
In another terminal, test the endpoint:

```bash
curl -X POST http://localhost:3000/api/uat \
  -H "Content-Type: application/json" \
  -d '{"images":[]}'
```

You should get a validation error (expected - we need real images).

### 5.6 Test with Frontend
1. In one terminal: `vercel dev` (API server)
2. In another terminal: `npm run dev` (Vite frontend)
3. Open `http://localhost:5173`
4. Upload some images
5. Watch the console for API calls

**✅ Success Check:**
- Vercel dev server runs without errors
- Frontend can call `/api/uat`
- You see network requests in browser DevTools
- Scenarios are generated (or you see helpful error messages)

---

## Step 6: Deploy to Vercel

### 6.1 Deploy
```bash
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy if you connected the repo.

### 6.2 Get Your Deployment URL
After deployment, Vercel shows:
```
✅ Production: https://your-project-name.vercel.app
```

**Copy this URL!**

### 6.3 Update Frontend Config
Update `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  baseURL: import.meta.env.DEV 
    ? 'http://localhost:3000'
    : 'https://your-project-name.vercel.app', // ← Replace with your actual URL
  
  endpoint: '/api/uat',
  timeout: 60000,
};
```

### 6.4 Update CORS in API
In `api/uat.ts`, update the `allowedOrigins` array:

```typescript
const allowedOrigins = [
  'https://yourusername.github.io', // Your GitHub Pages URL
  'https://your-project-name.vercel.app', // Your Vercel URL (optional)
  'http://localhost:5173',
  'http://localhost:3000',
];
```

### 6.5 Rebuild Frontend
```bash
npm run build
```

**✅ Success Check:**
- Vercel deployment succeeds
- API endpoint accessible at `https://your-project.vercel.app/api/uat`
- Environment variable `OPENAI_API_KEY` is set in Vercel dashboard

---

## Step 7: Update GitHub Pages Deployment

### 7.1 Update Vite Config (Optional - for env vars)
If you want to use environment variables in frontend:

Create `.env.production`:
```
VITE_VERCEL_API_URL=https://your-project-name.vercel.app
```

Update `vite.config.ts` to use it (already handled in our code).

### 7.2 Rebuild and Deploy to GitHub Pages
```bash
npm run build
```

Then push `dist/` to your `gh-pages` branch or use GitHub Actions (already configured).

**✅ Success Check:**
- GitHub Pages site works
- Can upload images and generate scenarios
- Network tab shows calls to Vercel API

---

## Step 8: Security & Cost Guardrails

### Already Implemented:
✅ Rate limiting (10 requests/hour per IP)  
✅ Payload size limits (20MB total, 10 images max)  
✅ Input validation  
✅ API key server-side only  

### Optional: Add Vercel KV for Better Rate Limiting
If you need more robust rate limiting:

1. Install Vercel KV:
```bash
npm install @vercel/kv
```

2. Update `api/uat.ts` to use KV instead of in-memory map (see Vercel KV docs)

### Monitor Costs:
- Check OpenAI usage: https://platform.openai.com/usage
- Set up billing alerts in OpenAI dashboard
- Monitor Vercel function invocations in Vercel dashboard

---

## Summary of Files Changed

**New Files:**
- `api/uat.ts` - Vercel serverless function
- `src/config/api.ts` - API configuration
- `src/services/openaiApi.ts` - API service
- `.env.local` - Local environment (gitignored)
- `VERCEL_SETUP_GUIDE.md` - This guide

**Modified Files:**
- `src/components/ScenarioGenerator.tsx` - Added OpenAI API call
- `package.json` - Added `@vercel/node` dev dependency

**No Changes Needed:**
- Existing scenario display/copy functionality works as-is
- Local fallback (tesseract.js) still available

---

## Troubleshooting

**API returns 500:**
- Check Vercel function logs: Dashboard → Your Project → Functions tab
- Verify `OPENAI_API_KEY` is set in Vercel
- Check OpenAI API key is valid

**CORS errors:**
- Update `allowedOrigins` in `api/uat.ts` with your actual GitHub Pages URL

**Timeout errors:**
- Increase timeout in `src/services/openaiApi.ts` (currently 60s)
- OpenAI Vision can be slow with many/large images

**Rate limit errors:**
- Wait 1 hour or increase `RATE_LIMIT` in `api/uat.ts`

---

## Next Steps

1. ✅ Complete Step 1 (Vercel account + repo connection)
2. ✅ Complete Step 2 (Create API function)
3. ✅ Complete Step 3 (Add environment variable)
4. ✅ Complete Step 4 (Update frontend)
5. ✅ Complete Step 5 (Local testing)
6. ✅ Complete Step 6 (Deploy)
7. ✅ Complete Step 7 (Update GitHub Pages)
8. ✅ Monitor and adjust as needed

Good luck! 🚀
