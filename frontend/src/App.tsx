import { useState, useEffect } from "react";
import { SaveEntry, AnalyzeJournal, AnalyzeJournalCloud, GetEntries } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models"; // Import models for Entry type
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";
import { TrendsChart } from "./components/TrendsChart";
import { Heatmap } from "./components/Heatmap";

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

    // pass detected emotions if available
    const emotionsToSave = aiResponse?.emotions || [];

    await SaveEntry(currentEntryId, entryTitle, journalText, emotionsToSave);
    await refreshHistory();

    // reset editor for new entry
    setJournalText("");
    setEntryTitle("");
    setAiResponse(null);
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
    if (entry.emotions && entry.emotions.length > 0) {
      setAiResponse({ emotions: entry.emotions, coaching: "Analysis from history." });
    } else {
      setAiResponse(null);
    }
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
      case "trends":
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-serif text-white/90 mb-6">Emotional Trends</h2>
            <TrendsChart entries={history} />
          </div>
        );
      case "home":
        return (
          <div className="flex flex-col items-center justify-center h-full gap-8 p-8 animate-in fade-in duration-700">
            <div className="text-center">
              <h2 className="text-3xl font-serif text-white/90 mb-2">Good Morning, Alex.</h2>
              <p className="text-gray-400 font-light">What's on your mind today?</p>
            </div>

            <Heatmap entries={history} />

            <button
              onClick={() => setActiveView("write")}
              className="px-8 py-3 bg-white text-slate-900 font-semibold rounded-full hover:bg-accent/90 transition-all shadow-[0_0_20px_rgba(45,212,191,0.3)]"
            >
              Start Writing
            </button>
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

