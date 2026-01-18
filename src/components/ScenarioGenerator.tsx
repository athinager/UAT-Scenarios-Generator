import { useState, useEffect, useCallback } from 'react';
import { UploadedImage } from '../App';
import { analyzeImage, ImageAnalysis } from '../utils/imageAnalysis';
import { generateScenarios, formatScenarios, Scenario } from '../utils/scenarioGenerator';
import './ScenarioGenerator.css';

interface ScenarioGeneratorProps {
  images: UploadedImage[];
  onCopy: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function ScenarioGenerator({ images, onCopy }: ScenarioGeneratorProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [, setAnalyses] = useState<ImageAnalysis[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
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

  const copyScenario = useCallback(async (scenario: Scenario) => {
    try {
      await navigator.clipboard.writeText(scenario.content);
      onCopy('Scenario copied to clipboard', 'success');
    } catch (error) {
      onCopy('Failed to copy scenario', 'error');
    }
  }, [onCopy]);

  const copyAllScenarios = useCallback(async () => {
    try {
      const formatted = formatScenarios(scenarios);
      await navigator.clipboard.writeText(formatted);
      onCopy(`All ${scenarios.length} scenarios copied to clipboard`, 'success');
    } catch (error) {
      onCopy('Failed to copy scenarios', 'error');
    }
  }, [scenarios, onCopy]);

  const exportToFile = useCallback(() => {
    try {
      const formatted = formatScenarios(scenarios);
      const blob = new Blob([formatted], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'uat-scenarios.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onCopy('Scenarios exported to uat-scenarios.txt', 'success');
    } catch (error) {
      onCopy('Failed to export scenarios', 'error');
    }
  }, [scenarios, onCopy]);

  if (images.length === 0) {
    return null;
  }

  if (isAnalyzing) {
    return (
      <section className="scenario-generator" aria-label="Generating scenarios">
        <div className="analyzing-container">
          <h2>Analyzing Images...</h2>
          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${analysisProgress}%` }}
              role="progressbar"
              aria-valuenow={analysisProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Analysis progress: ${Math.round(analysisProgress)}%`}
            />
          </div>
          <p className="progress-text">{Math.round(analysisProgress)}% complete</p>
        </div>
      </section>
    );
  }

  if (scenarios.length === 0) {
    return (
      <section className="scenario-generator" aria-label="Generated scenarios">
        <h2>Generated Scenarios</h2>
        <p className="empty-state">No scenarios generated yet. Upload images to begin.</p>
      </section>
    );
  }

  return (
    <section className="scenario-generator" aria-label="Generated UAT scenarios">
      <div className="scenario-header">
        <h2>Generated Scenarios ({scenarios.length})</h2>
        <div className="scenario-actions">
          <button
            type="button"
            className="action-button"
            onClick={copyAllScenarios}
            aria-label="Copy all scenarios to clipboard"
          >
            Copy All
          </button>
          <button
            type="button"
            className="action-button"
            onClick={exportToFile}
            aria-label="Export scenarios to text file"
          >
            Export .txt
          </button>
        </div>
      </div>

      <div className="scenarios-list" role="list">
        {scenarios.map((scenario, index) => (
          <div
            key={`${scenario.screen}-${index}`}
            className="scenario-card"
            role="listitem"
          >
            <p className="scenario-content">{scenario.content}</p>
            <button
              type="button"
              className="copy-button"
              onClick={() => copyScenario(scenario)}
              aria-label={`Copy scenario: ${scenario.content.substring(0, 50)}...`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ScenarioGenerator;
