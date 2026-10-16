import { useMemo, useState } from "react";

type Change = {
  type: string;
  original: string;
  corrected: string;
};

type CorrectionResponse = {
  original: string;
  corrected: string;
  changes: Change[];
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

const exampleText =
  "I has been working on this project since two months. I am not able to completed it.";

export default function App() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"minimal" | "polished">("minimal");
  const [result, setResult] = useState<CorrectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(
    () => text.trim() ? text.trim().split(/\s+/).length : 0,
    [text]
  );

  async function correctText() {
    if (!text.trim()) {
      setError("Enter a sentence, passage, or letter first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch(`${API_URL}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), mode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Correction failed. Is the backend running?");
      }
      setResult(data as CorrectionResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access failed. Select and copy the corrected text manually.");
    }
  }

  return (
    <main className="page-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="GrammarBot home">
          <span className="brand-mark">G</span>
          <span>Grammar<span className="brand-light">Bot</span></span>
        </a>
        <span className="local-label"><span className="status-dot" /> AI writing assistant</span>
      </nav>

      <section className="hero">
        <div className="eyebrow">WRITE WITH CONFIDENCE</div>
        <h1>Good writing starts<br /><span>with clarity.</span></h1>
        <p className="subtitle">
          Correct grammar, polish your sentences, and communicate what you mean.
          Your words stay yours.
        </p>
      </section>

      <section className="workspace">
        <div className="editor-card">
          <div className="card-header">
            <div>
              <span className="step-label">01 / YOUR TEXT</span>
              <h2>Original text</h2>
            </div>
            <button className="text-button" onClick={() => setText(exampleText)}>
              Try an example ↗
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste or type your sentence, passage, or letter here..."
            maxLength={6000}
            aria-label="Original text"
          />

          <div className="editor-footer">
            <span>{wordCount} words · {text.length}/6000 characters</span>
            <button className="text-button" onClick={() => { setText(""); setResult(null); setError(""); }}>
              Clear
            </button>
          </div>

          <div className="options-row">
            <label htmlFor="mode">Correction style</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as "minimal" | "polished")}>
              <option value="minimal">Minimal corrections</option>
              <option value="polished">Polished (MVP: same model)</option>
            </select>
          </div>

          <button className="primary-button" onClick={correctText} disabled={loading || !text.trim()}>
            {loading ? <><span className="spinner" /> Correcting text...</> : <>✦ &nbsp; Correct my writing <span>→</span></>}
          </button>
          <p className="privacy-note">Runs through your local backend. First request may take a while while the model loads.</p>
          {error && <div className="error-message" role="alert">{error}</div>}
        </div>

        <div className={`result-card ${result ? "has-result" : ""}`}>
          <div className="card-header">
            <div>
              <span className="step-label">02 / THE RESULT</span>
              <h2>Corrected text</h2>
            </div>
            {result && <button className="text-button" onClick={copyResult}>{copied ? "Copied ✓" : "Copy text ↗"}</button>}
          </div>

          {result ? (
            <>
              <div className="result-text">{result.corrected}</div>
              <div className="result-divider" />
              <div className="changes-heading">CHANGES DETECTED <span>{result.changes.length}</span></div>
              {result.changes.length ? (
                <ul className="change-list">
                  {result.changes.map((change, index) => (
                    <li key={`${index}-${change.original}-${change.corrected}`}>
                      <span className="change-old">{change.original || "∅"}</span>
                      <span className="change-arrow">→</span>
                      <span className="change-new">{change.corrected || "∅"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-changes">No word-level changes detected.</p>
              )}
              <button className="secondary-button" onClick={() => setText(result.corrected)}>
                Use corrected text as input ↗
              </button>
            </>
          ) : (
            <div className="empty-state">
              <div className="document-icon">
                <div /><div /><div /><span>✓</span>
              </div>
              <h3>Your improved text will appear here</h3>
              <p>Paste your writing on the left and run GrammarBot to see the correction.</p>
              <div className="feature-pills"><span>Grammar</span><span>Punctuation</span><span>Clarity</span></div>
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>GrammarBot <span className="footer-muted">· A learning project</span></span>
        <span>Review AI suggestions before using important documents.</span>
      </footer>
    </main>
  );
}
