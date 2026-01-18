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
