import { FormEvent, useCallback } from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import CardBody from './CardBody';
import './FigmaLinkInput.css';

function isValidFigmaUrl(url: string): boolean {
  const t = url.trim();
  if (t.length < 10 || t.length > 2048) return false;
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    return /figma\.com/i.test(u.hostname);
  } catch {
    return false;
  }
}

interface FigmaLinkInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  disabled?: boolean;
}

function FigmaLinkInput({
  value,
  onChange,
  onGenerate,
  showToast,
  disabled,
}: FigmaLinkInputProps) {
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!isValidFigmaUrl(value)) {
        showToast(
          'Please paste a valid Figma link (e.g. figma.com/design/… or figma.com/file/…).',
          'error'
        );
        return;
      }
      onGenerate();
    },
    [value, onGenerate, showToast]
  );

  return (
    <Card className="figma-link-card">
      <CardHeader>
        <h2 className="figma-link-card-title">Paste Figma link</h2>
      </CardHeader>
      <CardBody>
        <form className="figma-link-form" onSubmit={handleSubmit}>
          <div className="figma-paste-panel">
            <div className="figma-paste-panel-inner">
              <div className="figma-paste-icon-wrap" aria-hidden="true">
                <svg
                  className="figma-paste-icon"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 5.5H15C16.933 5.5 18.5 7.067 18.5 9V12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15.5 8.5L18.5 12L15.5 15.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5.5 12V15C5.5 16.933 7.067 18.5 9 18.5H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="figma-paste-lead">
                Paste the URL of your Figma file or frame. Scenarios will use this link as the design
                reference.
              </p>
            </div>
          </div>

          <div className="figma-field-block">
            <label htmlFor="figma-url" className="figma-link-label">
              Figma URL
            </label>
            <textarea
              id="figma-url"
              className="figma-link-textarea"
              rows={4}
              placeholder="https://www.figma.com/design/…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              aria-describedby="figma-link-hint"
              autoComplete="off"
              spellCheck={false}
            />
            <p id="figma-link-hint" className="figma-link-hint">
              Tip: copy from your browser while the file is open, or use <strong>Share</strong> →{' '}
              <strong>Copy link</strong> in Figma.
            </p>
          </div>

          <button type="submit" className="figma-generate-button" disabled={disabled}>
            Generate scenarios
          </button>
        </form>
      </CardBody>
    </Card>
  );
}

export default FigmaLinkInput;
