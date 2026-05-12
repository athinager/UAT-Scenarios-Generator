import { useState, useCallback } from 'react';
import FigmaLinkInput from './components/FigmaLinkInput';
import ScenarioGenerator from './components/ScenarioGenerator';
import Toast from './components/Toast';
import PageContainer from './components/PageContainer';
import './App.css';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function App() {
  const [linkDraft, setLinkDraft] = useState('');
  const [activeFigmaLink, setActiveFigmaLink] = useState('');
  const [generateToken, setGenerateToken] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleGenerate = useCallback(() => {
    const trimmed = linkDraft.trim();
    setActiveFigmaLink(trimmed);
    setGenerateToken((n) => n + 1);
  }, [linkDraft]);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <PageContainer>
        <header className="app-hero">
          <h1>UAT Scenarios Generator</h1>
          <p className="subtitle">
            Paste a Figma link to generate structured UAT scenarios from your designs
          </p>
        </header>

        <main id="main-content" className="app-main">
          <div className="workspace-grid">
            <FigmaLinkInput
              value={linkDraft}
              onChange={setLinkDraft}
              onGenerate={handleGenerate}
              showToast={showToast}
            />
          </div>

          {activeFigmaLink !== '' && (
            <ScenarioGenerator
              key={`${activeFigmaLink}-${generateToken}`}
              figmaLink={activeFigmaLink}
              onNotify={showToast}
            />
          )}
        </main>
      </PageContainer>

      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </div>
  );
}

export default App;
