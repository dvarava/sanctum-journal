import { useState, useEffect } from "react";
import { SaveEntry, AnalyzeJournal, GetEntries } from "../wailsjs/go/main/App";

function App() {
  const [journalText, setJournalText] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  // load history on mount
  useEffect(() => {
    refreshHistory();
  }, []);

  const refreshHistory = async () => {
    const entries = await GetEntries();
    setHistory(entries || []);
  };

  const handleSave = async () => {
    if (!journalText) return;
    setStatus("Encrypting & Saving...");
    const result = await SaveEntry(journalText);
    setStatus(result);
    refreshHistory();
    setJournalText(""); // clear input
  };

  const handleAnalyze = async () => {
    if (!journalText) return;
    setStatus("Analyzing with Local AI...");
    const result = await AnalyzeJournal(journalText);
    setAiResponse(result);
    setStatus("Analysis Complete.");
  };

  return (
    <div
      id="app"
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "sans-serif",
        backgroundColor: "black",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ color: "#fff" }}>Sanctum Journal (Prototype)</h1>
      <div style={{ display: "flex", gap: "20px" }}>
        {/* Left Column: Input */}
        <div style={{ flex: 2 }}>
          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Write your thoughts here..."
            style={{
              width: "100%",
              height: "200px",
              padding: "10px",
              fontSize: "16px",
            }}
          />

          <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
            <button
              onClick={handleSave}
              style={{ padding: "10px 20px", cursor: "pointer" }}
            >
              🔒 Encrypt & Save
            </button>
            <button
              onClick={handleAnalyze}
              style={{
                padding: "10px 20px",
                cursor: "pointer",
                backgroundColor: "#e0f7fa",
              }}
            >
              ✨ AI Analyze
            </button>
          </div>

          <p style={{ color: "gray", fontSize: "14px" }}>Status: {status}</p>

          {aiResponse && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#f0f4f8",
                borderLeft: "4px solid #007acc",
              }}
            >
              <strong style={{ color: "gray", fontSize: "14px" }}>🤖 AI Coach:</strong>
              <p style={{ color: "gray", fontSize: "14px" }}>{aiResponse}</p>
            </div>
          )}
        </div>

        {/* Right Column: History */}
        <div
          style={{ flex: 1, borderLeft: "1px solid #ddd", paddingLeft: "20px" }}
        >
          <h3>Decrypted History</h3>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {history.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "10px",
                  padding: "10px",
                  backgroundColor: "#074961ff",
                  border: "1px solid #eee",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px" }}>{entry}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
