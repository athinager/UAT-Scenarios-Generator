import { ImageAnalysis } from './imageAnalysis';
import { UploadedImage } from '../App';

export interface Scenario {
  screen: number;
  type: 'screen' | 'flow';
  content: string;
}

/**
 * Generates UAT scenarios based on image analysis
 */
export function generateScenarios(
  images: UploadedImage[],
  analyses: ImageAnalysis[]
): Scenario[] {
  const scenarios: Scenario[] = [];
  
  // Generate screen-specific scenarios
  images.forEach((image, index) => {
    const analysis = analyses[index];
    if (!analysis) return;
    
    const screenName = image.name || `Screen ${index + 1}`;
    const screenScenarios = generateScreenScenarios(screenName, index + 1, analysis);
    scenarios.push(...screenScenarios);
  });
  
  // Generate cross-screen flow scenarios
  const flowScenarios = generateFlowScenarios(images, analyses);
  scenarios.push(...flowScenarios);
  
  return scenarios;
}

function generateScreenScenarios(screenName: string, screenNum: number, analysis: ImageAnalysis): Scenario[] {
  const scenarios: Scenario[] = [];
  const { text, elements } = analysis;
  
  // Screen label scenario
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify screen displays correctly with all expected elements`,
  });
  
  // Text-based scenarios
  if (text) {
    // Extract potential form fields, buttons, labels from text
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('submit') || lowerLine.includes('save') || lowerLine.includes('confirm')) {
        scenarios.push({
          screen: screenNum,
          type: 'screen',
          content: `[${screenName}] Verify "${line.trim()}" button/CTA is visible and functional`,
        });
      }
      
      if (lowerLine.includes('email') || lowerLine.includes('password') || lowerLine.includes('name')) {
        scenarios.push({
          screen: screenNum,
          type: 'screen',
          content: `[${screenName}] Verify form field "${line.trim()}" accepts valid input and displays validation errors for invalid input`,
        });
      }
      
      if (lowerLine.includes('error') || lowerLine.includes('invalid') || lowerLine.includes('required')) {
        scenarios.push({
          screen: screenNum,
          type: 'screen',
          content: `[${screenName}] Verify error message "${line.trim()}" displays appropriately for invalid inputs`,
        });
      }
    });
  }
  
  // Element-based scenarios
  const elementTypes = new Set(elements.map(e => e.type));
  
  if (elementTypes.has('button')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify all buttons/CTAs are visible, have clear labels, and are accessible via keyboard navigation`,
    });
    
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify disabled button states are visually distinct and non-interactive`,
    });
  }
  
  if (elementTypes.has('form')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify required fields are clearly marked and prevent submission when empty`,
    });
    
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify field validation (format, length, boundary values) works correctly`,
    });
    
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify form preserves entered values when navigating away and returning`,
    });
  }
  
  if (elementTypes.has('header')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify page headers and titles are clear and descriptive`,
    });
  }
  
  if (elementTypes.has('navigation')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify navigation elements are accessible and tab order follows logical flow`,
    });
  }
  
  if (elementTypes.has('modal')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify modal/dialog can be closed via ESC key and close button, with focus trap inside modal`,
    });
  }
  
  if (elementTypes.has('table') || elementTypes.has('list')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify table/list data displays correctly with proper formatting and alignment`,
    });
    
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify empty state message displays when table/list has no data`,
    });
  }
  
  if (elementTypes.has('checkbox') || elementTypes.has('radio') || elementTypes.has('toggle')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify checkboxes/radio buttons/toggles are keyboard accessible and have clear labels`,
    });
  }
  
  if (elementTypes.has('link')) {
    scenarios.push({
      screen: screenNum,
      type: 'screen',
      content: `[${screenName}] Verify links are clearly distinguishable and open in expected context`,
    });
  }
  
  // Accessibility scenarios
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify keyboard navigation (Tab, Enter, Space, Arrow keys) works correctly`,
  });
  
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify focus indicators are visible and elements have readable labels for screen readers`,
  });
  
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify content is responsive and readable on different screen sizes`,
  });
  
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify text overflow is handled gracefully (i18n scenarios) with proper truncation or wrapping`,
  });
  
  // Loading and error states
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify loading states display appropriately during data fetch/processing`,
  });
  
  scenarios.push({
    screen: screenNum,
    type: 'screen',
    content: `[${screenName}] Verify network error handling with user-friendly error messages and retry options`,
  });
  
  return scenarios;
}

function generateFlowScenarios(images: UploadedImage[], _analyses: ImageAnalysis[]): Scenario[] {
  const scenarios: Scenario[] = [];
  
  if (images.length < 2) {
    return scenarios;
  }
  
  const firstScreen = images[0]?.name || 'Screen 1';
  const lastScreen = images[images.length - 1]?.name || `Screen ${images.length}`;
  
  // Happy path flow
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Happy Path: Complete user flow from ${firstScreen} to ${lastScreen} with all valid inputs and verify successful completion`,
  });
  
  // Navigation flows
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify back/forward navigation preserves form data and user selections across screens`,
  });
  
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify browser back button works correctly and returns to previous screen with state preserved`,
  });
  
  // Validation flows
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Negative Path: Submit invalid data at each screen and verify validation prevents progression with clear error messages`,
  });
  
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify cross-screen validation (e.g., password confirmation, matching fields) works correctly`,
  });
  
  // Permission/role-based flows
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify permission-based access control restricts unauthorized screens/actions appropriately`,
  });
  
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify role-based scenarios (admin, user, guest) display appropriate screens and features`,
  });
  
  // Edge cases
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify boundary value testing (min/max lengths, date ranges, numeric limits) across all input fields`,
  });
  
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify flow handles session timeout and requires re-authentication appropriately`,
  });
  
  scenarios.push({
    screen: 0,
    type: 'flow',
    content: `[Flow] Verify state persistence when user leaves and returns to the flow (refresh, close/reopen browser)`,
  });
  
  return scenarios;
}

/**
 * Formats scenarios as plain text
 */
export function formatScenarios(scenarios: Scenario[]): string {
  const screenScenarios = scenarios.filter(s => s.type === 'screen');
  const flowScenarios = scenarios.filter(s => s.type === 'flow');
  
  let output = '';
  
  // Group screen scenarios by screen number
  const screenGroups = new Map<number, Scenario[]>();
  screenScenarios.forEach(s => {
    if (!screenGroups.has(s.screen)) {
      screenGroups.set(s.screen, []);
    }
    screenGroups.get(s.screen)!.push(s);
  });
  
  // Output screen scenarios
  screenGroups.forEach((scenarios, _screenNum) => {
    scenarios.forEach(scenario => {
      output += `${scenario.content}\n`;
    });
  });
  
  // Output flow scenarios
  if (flowScenarios.length > 0) {
    flowScenarios.forEach(scenario => {
      output += `${scenario.content}\n`;
    });
  }
  
  return output.trim();
}
