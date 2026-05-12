import { useState, useEffect, useCallback } from 'react';
import { generateScenariosFromFigmaLink } from '../services/openaiApi';
import {
  UATScenario,
  scenariosToCsv,
  newScenarioId,
  TestOutcome,
  ScenarioStatus,
} from '../utils/scenarioGenerator';
import './ScenarioGenerator.css';

interface ScenarioGeneratorProps {
  figmaLink: string;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function formatScenarioForClipboard(s: UATScenario): string {
  const stepsBlock = s.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  return [
    `Scenario name: ${s.name}`,
    `Flow or screen: ${s.flowOrScreen}`,
    `Description: ${s.description}`,
    `Steps:\n${stepsBlock}`,
    `Figma link: ${s.figmaLink}`,
    `Expected result: ${s.expectedResult}`,
    `Status: ${s.status}`,
    `Test result: ${s.testResult || '(not set)'}`,
    s.failDescription ? `Fail description: ${s.failDescription}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function ScenarioGenerator({ figmaLink, onNotify }: ScenarioGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scenarios, setScenarios] = useState<UATScenario[]>([]);

  useEffect(() => {
    if (!figmaLink.trim()) {
      setScenarios([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const next = await generateScenariosFromFigmaLink(figmaLink);
        if (!cancelled) {
          setScenarios(next);
          onNotify(`Generated ${next.length} UAT scenarios`, 'success');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setScenarios([]);
          const msg = e instanceof Error ? e.message : 'Failed to generate scenarios';
          onNotify(msg, 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [figmaLink, onNotify]);

  const patchScenario = useCallback((id: string, patch: Partial<UATScenario>) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }, []);

  const updateStepsFromText = useCallback((id: string, text: string) => {
    const steps = text
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    patchScenario(id, { steps });
  }, [patchScenario]);

  const exportCsv = useCallback(() => {
    try {
      const csv = `\ufeff${scenariosToCsv(scenarios)}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'uat-scenarios.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify(`Exported ${scenarios.length} scenario(s) to CSV`, 'success');
    } catch {
      onNotify('Failed to export CSV', 'error');
    }
  }, [scenarios, onNotify]);

  const copyAll = useCallback(async () => {
    try {
      const text = scenarios.map(formatScenarioForClipboard).join('\n\n---\n\n');
      await navigator.clipboard.writeText(text);
      onNotify(`Copied ${scenarios.length} scenario(s)`, 'success');
    } catch {
      onNotify('Failed to copy', 'error');
    }
  }, [scenarios, onNotify]);

  const copyOne = useCallback(
    async (s: UATScenario) => {
      try {
        await navigator.clipboard.writeText(formatScenarioForClipboard(s));
        onNotify('Scenario copied to clipboard', 'success');
      } catch {
        onNotify('Failed to copy scenario', 'error');
      }
    },
    [onNotify]
  );

  const addManualScenario = useCallback(() => {
    const blank: UATScenario = {
      id: newScenarioId(),
      name: 'New scenario',
      flowOrScreen: '',
      description:
        'Verify that [action/selection], correctly [expected system response], in/on the [affected area/component].',
      steps: ['Arrange the starting state.', 'Perform the action.', 'Observe the outcome.'],
      figmaLink,
      expectedResult: '',
      status: 'to-do',
      testResult: '',
      failDescription: '',
    };
    setScenarios((prev) => [...prev, blank]);
    onNotify('Added blank scenario', 'info');
  }, [figmaLink, onNotify]);

  if (!figmaLink.trim()) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="scenario-generator" aria-label="Generating scenarios">
        <div className="analyzing-container">
          <h2>Generating scenarios…</h2>
          <p className="progress-text">
            Using your Figma link and design context to build structured UAT scenarios.
          </p>
        </div>
      </section>
    );
  }

  if (scenarios.length === 0) {
    return (
      <section className="scenario-generator" aria-label="Generated scenarios">
        <h2 className="scenario-section-title">Scenarios</h2>
        <p className="empty-state">
          No scenarios yet. Check the error message above, or adjust your Figma link and generate again.
        </p>
      </section>
    );
  }

  return (
    <section className="scenario-generator" aria-label="Generated UAT scenarios">
      <div className="scenario-header">
        <h2 className="scenario-section-title">Scenarios ({scenarios.length})</h2>
        <div className="scenario-actions">
          <button type="button" className="action-button" onClick={addManualScenario}>
            Add scenario
          </button>
          <button type="button" className="action-button" onClick={copyAll}>
            Copy all
          </button>
          <button type="button" className="action-button action-button-primary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="scenarios-detail-list">
        {scenarios.map((scenario) => (
          <article key={scenario.id} className="scenario-detail-card">
            <div className="scenario-detail-toolbar">
              <button
                type="button"
                className="copy-button"
                onClick={() => copyOne(scenario)}
                aria-label={`Copy scenario ${scenario.name}`}
              >
                Copy
              </button>
            </div>

            <div className="scenario-fields">
              <label className="scenario-field">
                <span className="scenario-field-label">Scenario name</span>
                <input
                  type="text"
                  className="scenario-input"
                  value={scenario.name}
                  onChange={(e) => patchScenario(scenario.id, { name: e.target.value })}
                />
              </label>

              <label className="scenario-field">
                <span className="scenario-field-label">Flow or screen (tag)</span>
                <input
                  type="text"
                  className="scenario-input"
                  value={scenario.flowOrScreen}
                  onChange={(e) => patchScenario(scenario.id, { flowOrScreen: e.target.value })}
                  placeholder="e.g. Login · Flow: Onboarding"
                />
              </label>

              <label className="scenario-field scenario-field-span">
                <span className="scenario-field-label">Scenario description</span>
                <textarea
                  className="scenario-textarea scenario-textarea-sm"
                  rows={3}
                  value={scenario.description}
                  onChange={(e) => patchScenario(scenario.id, { description: e.target.value })}
                  placeholder='Verify that …, correctly …, in/on …'
                />
              </label>

              <label className="scenario-field scenario-field-span">
                <span className="scenario-field-label">Steps</span>
                <textarea
                  className="scenario-textarea"
                  rows={5}
                  value={scenario.steps.join('\n')}
                  onChange={(e) => updateStepsFromText(scenario.id, e.target.value)}
                  placeholder={'One step per line'}
                />
              </label>

              <label className="scenario-field scenario-field-span">
                <span className="scenario-field-label">Figma link</span>
                <input
                  type="url"
                  className="scenario-input"
                  value={scenario.figmaLink}
                  onChange={(e) => patchScenario(scenario.id, { figmaLink: e.target.value })}
                />
              </label>

              <label className="scenario-field scenario-field-span">
                <span className="scenario-field-label">Expected result</span>
                <textarea
                  className="scenario-textarea"
                  rows={4}
                  value={scenario.expectedResult}
                  onChange={(e) => patchScenario(scenario.id, { expectedResult: e.target.value })}
                  placeholder="What testers should observe; align with the linked Figma."
                />
              </label>

              <label className="scenario-field">
                <span className="scenario-field-label">Status</span>
                <select
                  className="scenario-select"
                  value={scenario.status}
                  onChange={(e) =>
                    patchScenario(scenario.id, { status: e.target.value as ScenarioStatus })
                  }
                >
                  <option value="to-do">To-do</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <label className="scenario-field">
                <span className="scenario-field-label">Test result</span>
                <select
                  className="scenario-select"
                  value={scenario.testResult}
                  onChange={(e) =>
                    patchScenario(scenario.id, {
                      testResult: e.target.value as TestOutcome,
                    })
                  }
                >
                  <option value="">Not set</option>
                  <option value="success">Success</option>
                  <option value="fail">Fail</option>
                </select>
              </label>

              <label className="scenario-field scenario-field-span">
                <span className="scenario-field-label">Fail description</span>
                <textarea
                  className="scenario-textarea scenario-textarea-sm"
                  rows={2}
                  value={scenario.failDescription}
                  onChange={(e) =>
                    patchScenario(scenario.id, { failDescription: e.target.value })
                  }
                  placeholder="If the test failed, describe what went wrong."
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ScenarioGenerator;
