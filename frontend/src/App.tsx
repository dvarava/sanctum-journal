import { useState, useEffect, useRef, useCallback } from "react";
import { SaveEntry, AnalyzeJournal, AnalyzeJournalCloud, GetEntries, DeleteEntry, CheckCrisisMarkers } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";
import { Heatmap } from "./components/Heatmap";
import { MoodLineChart } from "./components/MoodLineChart";
import { CrisisScreen } from "./components/CrisisScreen";

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

  // crisis state
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [crisisSeverity, setCrisisSeverity] = useState("");
  const crisisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // history state
  const [history, setHistory] = useState<main.Entry[]>([]);

  // load history on mount
  useEffect(() => {
    refreshHistory();
  }, []);

  // debounced real-time crisis checking as user types
  const checkForCrisis = useCallback((text: string) => {
    if (crisisTimerRef.current) {
      clearTimeout(crisisTimerRef.current);
    }
    // only check if there's enough text to be meaningful
    if (text.length < 10) {
      setIsCrisisActive(false);
      return;
    }
    crisisTimerRef.current = setTimeout(async () => {
      try {
        const result = await CheckCrisisMarkers(text);
        if (result.is_crisis) {
          setIsCrisisActive(true);
          setCrisisSeverity(result.severity);
        }
        // intentionally don't auto-clear crisis — user must dismiss
      } catch {
        // fail silently — crisis check is supplementary
      }
    }, 800); // 800ms debounce
  }, []);

  // wire crisis check to text changes
  const handleTextChange = (text: string) => {
    setJournalText(text);
    checkForCrisis(text);
  };

  const handleCrisisDismiss = () => {
    setIsCrisisActive(false);
    setCrisisSeverity("");
  };

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
    if (!journalText || isCrisisActive) return;
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

  const handleDelete = async () => {
    if (currentEntryId === 0) return;

    // need to add a confirmation modal here
    await DeleteEntry(currentEntryId);
    await refreshHistory();

    handleNewEntry();
  };

  const handleNewEntry = () => {
    setJournalText("");
    setEntryTitle("");
    setAiResponse(null);
    setCurrentEntryId(0);
    setIsSaving(false);
    setActiveView("write");
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
            onChange={handleTextChange}
            onSave={handleSave}
            onDelete={handleDelete}
            onNew={handleNewEntry}
            currentEntryId={currentEntryId}
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
          <div className="flex flex-col items-center justify-center h-full gap-8 p-8 animate-in fade-in duration-700">
            <div className="text-center">
              <h2 className="text-3xl font-serif text-white/90 mb-2">Good Morning, Alex.</h2>
              <p className="text-gray-400 font-light">What's on your mind today?</p>
            </div>

            <div className="flex flex-wrap items-stretch justify-center gap-6 w-full max-w-5xl">
              <div className="flex-1 min-w-[300px]">
                <Heatmap entries={history} />
              </div>
              <div className="flex-1 min-w-[300px]">
                <MoodLineChart entries={history} />
              </div>
            </div>

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
    <>
      {/* Crisis overlay — renders on top of everything */}
      {isCrisisActive && (
        <CrisisScreen
          severity={crisisSeverity}
          onDismiss={handleCrisisDismiss}
        />
      )}

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
    </>
  );
}

export default App;

