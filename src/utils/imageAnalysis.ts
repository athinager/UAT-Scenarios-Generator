import { createWorker } from 'tesseract.js';

export interface UIElement {
  type: 'button' | 'form' | 'header' | 'navigation' | 'modal' | 'table' | 'list' | 'toggle' | 'checkbox' | 'radio' | 'link' | 'error' | 'empty' | 'loading';
  confidence: number;
  text?: string;
}

export interface ImageAnalysis {
  text: string;
  elements: UIElement[];
}

/**
 * Performs OCR on an image using tesseract.js
 */
export async function performOCR(imageFile: File): Promise<string> {
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageFile);
    await worker.terminate();
    return text.trim();
  } catch (error) {
    console.error('OCR failed:', error);
    return '';
  }
}

/**
 * Lightweight CV heuristics to detect UI elements
 * Uses canvas sampling and edge detection patterns
 */
export async function detectUIElements(imageFile: File): Promise<UIElement[]> {
  const elements: UIElement[] = [];
  
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(elements);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Detect rectangles (potential buttons, forms, cards)
      const rectangles = detectRectangles(imageData);
      
      // Detect text regions (potential headers, labels)
      const textRegions = detectTextRegions(imageData);
      
      // Detect circular elements (potential checkboxes, radios, buttons)
      const circularElements = detectCircularElements(imageData);
      
      // Detect lines (potential navigation, separators, tables)
      const lines = detectLines(imageData);
      
      // Classify detected shapes into UI elements
      rectangles.forEach(rect => {
        if (rect.height < 50 && rect.width > 80) {
          elements.push({ type: 'button', confidence: 0.6 });
        } else if (rect.width > 200 && rect.height > 100) {
          elements.push({ type: 'form', confidence: 0.5 });
        }
      });
      
      textRegions.forEach(() => {
        elements.push({ type: 'header', confidence: 0.4 });
      });
      
      circularElements.forEach(() => {
        elements.push({ type: 'checkbox', confidence: 0.3 });
      });
      
      if (lines.length > 5) {
        elements.push({ type: 'table', confidence: 0.5 });
        elements.push({ type: 'navigation', confidence: 0.4 });
      }
      
      URL.revokeObjectURL(url);
      resolve(elements);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(elements);
    };
    
    img.src = url;
  });
}

function detectRectangles(imageData: ImageData): Array<{ x: number; y: number; width: number; height: number }> {
  const rectangles: Array<{ x: number; y: number; width: number; height: number }> = [];
  const { width, height, data } = imageData;
  
  // Simplified rectangle detection using edge detection
  // Look for horizontal and vertical edges
  for (let y = 10; y < height - 10; y += 20) {
    for (let x = 10; x < width - 10; x += 20) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      // Simple edge detection threshold
      if (brightness < 100 || brightness > 200) {
        rectangles.push({ x, y, width: 100, height: 40 });
      }
    }
  }
  
  return rectangles.slice(0, 10); // Limit results
}

function detectTextRegions(imageData: ImageData): Array<{ x: number; y: number }> {
  const regions: Array<{ x: number; y: number }> = [];
  const { width, height, data } = imageData;
  
  // Look for high-contrast horizontal regions (likely text)
  for (let y = 0; y < height; y += 30) {
    let contrastCount = 0;
    for (let x = 0; x < width; x += 10) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      if (brightness > 150 || brightness < 100) {
        contrastCount++;
      }
    }
    
    if (contrastCount > width / 20) {
      regions.push({ x: 0, y });
    }
  }
  
  return regions.slice(0, 5);
}

function detectCircularElements(imageData: ImageData): Array<{ x: number; y: number }> {
  const elements: Array<{ x: number; y: number }> = [];
  const { width, height, data } = imageData;
  
  // Look for small circular patterns
  for (let y = 20; y < height - 20; y += 30) {
    for (let x = 20; x < width - 20; x += 30) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      
      if (brightness < 50 || brightness > 200) {
        elements.push({ x, y });
      }
    }
  }
  
  return elements.slice(0, 10);
}

function detectLines(imageData: ImageData): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const { width, height, data } = imageData;
  
  // Detect horizontal lines
  for (let y = 0; y < height; y += 50) {
    let edgeCount = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 100 || brightness > 200) {
        edgeCount++;
      }
    }
    
    if (edgeCount > width * 0.3) {
      lines.push({ x1: 0, y1: y, x2: width, y2: y });
    }
  }
  
  return lines;
}

/**
 * Analyzes an image: performs OCR and UI element detection
 */
export async function analyzeImage(imageFile: File): Promise<ImageAnalysis> {
  const [text, elements] = await Promise.all([
    performOCR(imageFile),
    detectUIElements(imageFile),
  ]);
  
  return { text, elements };
}
