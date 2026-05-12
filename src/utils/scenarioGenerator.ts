export type ScenarioStatus = 'to-do' | 'done';
export type TestOutcome = '' | 'success' | 'fail';

/** Full scenario row for display, editing, and export */
export interface UATScenario {
  id: string;
  name: string;
  flowOrScreen: string;
  description: string;
  steps: string[];
  figmaLink: string;
  expectedResult: string;
  status: ScenarioStatus;
  testResult: TestOutcome;
  failDescription: string;
}

export function newScenarioId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeScenarioFromApi(
  raw: Record<string, unknown>,
  figmaLink: string
): UATScenario {
  const stepsRaw = raw.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw.map((s) => String(s))
    : typeof stepsRaw === 'string'
      ? stepsRaw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
      : [];

  return {
    id: typeof raw.id === 'string' ? raw.id : newScenarioId(),
    name: String(raw.name ?? '').trim() || 'Untitled scenario',
    flowOrScreen: String(raw.flowOrScreen ?? raw.flow_or_screen ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    steps,
    figmaLink: String(raw.figmaLink ?? raw.figma_link ?? figmaLink).trim() || figmaLink,
    expectedResult: String(raw.expectedResult ?? raw.expected_result ?? '').trim(),
    status: raw.status === 'done' ? 'done' : 'to-do',
    testResult:
      raw.testResult === 'success' || raw.testResult === 'fail'
        ? raw.testResult
        : raw.test_result === 'success' || raw.test_result === 'fail'
          ? raw.test_result
          : '',
    failDescription: String(raw.failDescription ?? raw.fail_description ?? '').trim(),
  };
}

function escapeCsvField(field: string): string {
  const s = String(field ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Export scenarios as CSV (RFC-style quoting). */
export function scenariosToCsv(scenarios: UATScenario[]): string {
  const headers = [
    'Scenario name',
    'Flow or screen',
    'Scenario description',
    'Steps',
    'Figma link',
    'Expected result',
    'Status',
    'Test result',
    'Fail description',
  ];
  const lines = [
    headers.join(','),
    ...scenarios.map((s) =>
      [
        escapeCsvField(s.name),
        escapeCsvField(s.flowOrScreen),
        escapeCsvField(s.description),
        escapeCsvField(s.steps.join('\n')),
        escapeCsvField(s.figmaLink),
        escapeCsvField(s.expectedResult),
        escapeCsvField(s.status),
        escapeCsvField(s.testResult || ''),
        escapeCsvField(s.failDescription),
      ].join(',')
    ),
  ];
  return lines.join('\r\n');
}
