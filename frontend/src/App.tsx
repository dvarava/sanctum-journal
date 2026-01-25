import { useState, useEffect } from "react";
import { SaveEntry, AnalyzeJournal, AnalyzeJournalCloud, GetEntries } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models"; // Import models for Entry type
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";

interface AnalysisResult {
  emotions: string[];
  coaching: string;
}

function App() {
  const [activeView, setActiveView] = useState("write");

  // editor state
  const [currentEntryId, setCurrentEntryId] = useState(0); // 0 = new entry
  const [entryTitle, setEntryTitle] = useState("");
  const [journalText, setJournalText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [useCloud, setUseCloud] = useState(false); // default to Local (Privacy)

  // AI state
  const [aiResponse, setAiResponse] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState("");

  // history state
  const [history, setHistory] = useState<main.Entry[]>([]);

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

    await SaveEntry(currentEntryId, entryTitle, journalText);
    await refreshHistory();

    // reset editor for new entry
    setJournalText("");
    setEntryTitle("");
    setCurrentEntryId(0);
    setIsSaving(false);
  };

  const handleAnalyze = async () => {
    if (!journalText) return;
    setIsAnalyzing(true);

    if (useCloud) {
      setAiStatus("Connecting to Neural Cloud (Secure)...");
    } else {
      setAiStatus("Connecting to local neural engine...");
    }

    try {
      let result;
      if (useCloud) {
        // in production, app will prompt for an API key
        result = await AnalyzeJournalCloud(journalText, "mock-api-key");
      } else {
        result = await AnalyzeJournal(journalText);
      }

      setAiResponse(result as AnalysisResult);
    } catch (e) {
      setAiResponse({
        emotions: ["Error"],
        coaching: "Could not analyze entry. Please ensure Ollama is running or check your internet connection."
      });
    } finally {
      setIsAnalyzing(false);
      setAiStatus("");
    }
  };

  const handleSelectEntry = (entry: main.Entry) => {
    setCurrentEntryId(entry.id);
    setEntryTitle(entry.title);
    setJournalText(entry.content);
    setActiveView("write");
  };

  // render the active view
  const renderContent = () => {
    switch (activeView) {
      case "write":
        return (
          <Editor
            title={entryTitle}
            setTitle={setEntryTitle}
            value={journalText}
            onChange={setJournalText}
            onSave={handleSave}
            isSaving={isSaving}
            onAnalyze={handleAnalyze}
            useCloud={useCloud}
            setUseCloud={setUseCloud}
          />
        );
      case "history":
        return <HistoryList entries={history} onSelectEntry={handleSelectEntry} />;
      case "home":
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
        activeView === "write" ? (
          <AIPanel
            analysis={aiResponse}
            loading={isAnalyzing}
            status={aiStatus}
            useCloud={useCloud}
          />
        ) : undefined
      }
    >
      {renderContent()}
    </Layout>
  );
}

export default App;

