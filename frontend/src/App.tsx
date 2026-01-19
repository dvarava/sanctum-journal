import { useState, useEffect } from "react";
import { SaveEntry, AnalyzeJournal, GetEntries } from "../wailsjs/go/main/App";
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";

function App() {
  const [activeView, setActiveView] = useState("write");

  // editor state
  const [journalText, setJournalText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // AI state
  const [aiResponse, setAiResponse] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState("");

  // history state
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
    setIsSaving(true);

    // simulate a brief delay for visual feedback of "Encrypting"
    await new Promise(r => setTimeout(r, 800));

    await SaveEntry(journalText);
    await refreshHistory();

    setJournalText("");
    setIsSaving(false);
  };

  const handleAnalyze = async () => {
    if (!journalText) return;
    setIsAnalyzing(true);
    setAiStatus("Connecting to local neural engine...");

    try {
      const result = await AnalyzeJournal(journalText);
      setAiResponse(result);
    } catch (e) {
      setAiResponse("Error analyzing entry.");
    } finally {
      setIsAnalyzing(false);
      setAiStatus("");
    }
  };

  // render the active view
  const renderContent = () => {
    switch (activeView) {
      case "write":
        return (
          <Editor
            value={journalText}
            onChange={setJournalText}
            onSave={handleSave}
            isSaving={isSaving}
            onAnalyze={handleAnalyze}
          />
        );
      case "history":
        return <HistoryList entries={history} />;
      case "home":
        // Home redirects to Write for now or shows a dashboard later
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <h2 className="text-xl font-semibold mb-2">Welcome Back</h2>
            <button onClick={() => setActiveView("write")} className="text-accent hover:underline">Start Journaling</button>
          </div>
        );
      default:
        return <div className="p-10 text-center text-gray-500">Work in Progress</div>;
    }
  };

  return (
    <Layout
      activeView={activeView}
      onNavigate={setActiveView}
      rightPanel={
        <AIPanel
          analysis={aiResponse}
          loading={isAnalyzing}
          status={aiStatus}
        />
      }
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
