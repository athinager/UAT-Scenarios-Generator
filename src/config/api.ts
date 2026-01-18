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
