import { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, History as HistoryIcon, PenTool } from "lucide-react";
import { SaveEntry, AnalyzeJournalCloud, AnalyzeJournalForEntry, GetEntries, DeleteEntry, CheckCrisisMarkers, GetSettings } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";
import { Heatmap } from "./components/Heatmap";
import { MoodLineChart } from "./components/MoodLineChart";
import { CrisisScreen } from "./components/CrisisScreen";
import { Settings } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { AnalyzePromptToast } from "./components/AnalyzePromptToast";
import { VaultGate } from "./components/VaultGate";

interface AnalysisResult {
  emotions: string[];
  coaching: string;
}

interface SavedAnalysisPrompt {
  id: number;
  title: string;
  text: string;
}

const getEntriesThisWeek = (entries: main.Entry[]) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);

  return entries.filter((entry) => new Date(entry.created_at) >= weekAgo).length;
};

const getEntriesThisMonth = (entries: main.Entry[]) => {
  const now = new Date();

  return entries.filter((entry) => {
    const entryDate = new Date(entry.created_at);
    return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
  }).length;
};

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
  const [analyzedText, setAnalyzedText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [isOnboarding, setIsOnboarding] = useState(false);
  const journalTextRef = useRef(journalText);
  const currentEntryIdRef = useRef(currentEntryId);
  const [analysisPrompt, setAnalysisPrompt] = useState<SavedAnalysisPrompt | null>(null);

  // crisis state
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [crisisSeverity, setCrisisSeverity] = useState("");
  const crisisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // history state
  const [history, setHistory] = useState<main.Entry[]>([]);

  // user display name
  const [displayName, setDisplayName] = useState("");
  const [modelName, setModelName] = useState("qwen3:4b");
  const [emotionModel, setEmotionModel] = useState("default");
  const [crisisRegion, setCrisisRegion] = useState("global");
  const [vaultStatus, setVaultStatus] = useState<main.VaultStatus | null>(null);

  // load history + settings on mount and when navigating views
  useEffect(() => {
    if (!vaultStatus?.unlocked) return;
    refreshHistory();
    loadDisplayNameAndOnboarding();
  }, [activeView, vaultStatus?.unlocked]);

  useEffect(() => {
    journalTextRef.current = journalText;
  }, [journalText]);

  useEffect(() => {
    currentEntryIdRef.current = currentEntryId;
  }, [currentEntryId]);

  const loadDisplayNameAndOnboarding = async () => {
    try {
      const s = await GetSettings();
      setDisplayName(s.user_name || "");
      setModelName(s.model_name || "qwen3:4b");
      setEmotionModel(s.emotion_model || "default");
      setCrisisRegion(s.crisis_region || "global");
      if (s.onboarding_complete === false) {
        setIsOnboarding(true);
      }
    } catch { }
  };

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
    if (aiResponse && text !== analyzedText) {
      setAiResponse(null);
      setAnalyzedText("");
    }
    checkForCrisis(text);
  };

  const handleCrisisDismiss = () => {
    setIsCrisisActive(false);
    setCrisisSeverity("");
  };

  const refreshHistory = async () => {
    if (!vaultStatus?.unlocked) {
      setHistory([]);
      return [];
    }
    const entries = await GetEntries();
    const nextHistory = entries || [];
    setHistory(nextHistory);
    return nextHistory;
  };

  const handleSave = async () => {
    if (!vaultStatus?.unlocked) return;
    if (!journalText) return;
    setIsSaving(true);
    const savedEntryId = currentEntryId;
    const savedTitle = entryTitle;
    const savedText = journalText;

    // simulate a brief delay for visual feedback of "Encrypting"
    await new Promise(r => setTimeout(r, 800));

    // Save only the current insight the user explicitly generated.
    const currentInsight = aiResponse && analyzedText === journalText ? aiResponse : null;
    const emotionsToSave = currentInsight?.emotions || [];
    const coachingToSave = currentInsight?.coaching || "";

    await SaveEntry(currentEntryId, entryTitle, journalText, emotionsToSave, coachingToSave);
    const nextHistory = await refreshHistory();
    const savedEntry = savedEntryId > 0
      ? nextHistory.find((entry) => entry.id === savedEntryId)
      : nextHistory[0];

    if (!currentInsight && !isCrisisActive && savedEntry) {
      setAnalysisPrompt({
        id: savedEntry.id,
        title: savedEntry.title || savedTitle,
        text: savedEntry.content || savedText,
      });
    } else {
      setAnalysisPrompt(null);
    }

    // reset editor for new entry
    setJournalText("");
    setEntryTitle("");
    setAiResponse(null);
    setAnalyzedText("");
    setCurrentEntryId(0);
    currentEntryIdRef.current = 0;
    setIsSaving(false);
  };

  const runAnalysis = async (textToAnalyze: string, entryId: number) => {
    if (!vaultStatus?.unlocked) return;
    if (!textToAnalyze || isCrisisActive) return;
    setIsAnalyzing(true);

    if (useCloud) {
      setAiStatus("Connecting to Neural Cloud (Secure)...");
    } else {
      setAiStatus("Connecting to local neural engine...");
    }

    try {
      let result;
      if (useCloud) {
        // in production, app will prompt for an API key (decided to not implement Cloud mode)
        result = await AnalyzeJournalCloud(textToAnalyze, "mock-api-key");
      } else {
        result = await AnalyzeJournalForEntry(textToAnalyze, entryId);
      }

      if (journalTextRef.current === textToAnalyze && currentEntryIdRef.current === entryId) {
        setAiResponse(result as AnalysisResult);
        setAnalyzedText(textToAnalyze);
      }
    } catch (e) {
      if (journalTextRef.current === textToAnalyze && currentEntryIdRef.current === entryId) {
        setAiResponse({
          emotions: ["Error"],
          coaching: "Could not analyze entry. Please ensure Ollama is running or check your internet connection."
        });
        setAnalyzedText(textToAnalyze);
      }
    } finally {
      setIsAnalyzing(false);
      setAiStatus("");
    }
  };

  const handleAnalyze = async () => {
    await runAnalysis(journalText, currentEntryId);
  };

  const handleAnalyzeSavedEntry = async () => {
    if (!analysisPrompt) return;

    const entryToAnalyze = analysisPrompt;
    setAnalysisPrompt(null);
    setCurrentEntryId(entryToAnalyze.id);
    currentEntryIdRef.current = entryToAnalyze.id;
    setEntryTitle(entryToAnalyze.title);
    setJournalText(entryToAnalyze.text);
    journalTextRef.current = entryToAnalyze.text;
    setAiResponse(null);
    setAnalyzedText("");
    setActiveView("write");

    await runAnalysis(entryToAnalyze.text, entryToAnalyze.id);
  };

  const handleDelete = async () => {
    if (!vaultStatus?.unlocked) return;
    if (currentEntryId === 0) return;

    // !!! need to add a confirmation modal here !!!
    await DeleteEntry(currentEntryId);
    await refreshHistory();

    handleNewEntry();
  };

  const handleNewEntry = () => {
    setJournalText("");
    setEntryTitle("");
    setAiResponse(null);
    setAnalyzedText("");
    setCurrentEntryId(0);
    currentEntryIdRef.current = 0;
    setIsSaving(false);
    setActiveView("write");
  };

  const clearSensitiveState = () => {
    setCurrentEntryId(0);
    currentEntryIdRef.current = 0;
    setEntryTitle("");
    setJournalText("");
    journalTextRef.current = "";
    setAiResponse(null);
    setAnalyzedText("");
    setIsAnalyzing(false);
    setAiStatus("");
    setIsSaving(false);
    setHistory([]);
    setDisplayName("");
    setModelName("qwen3:4b");
    setEmotionModel("default");
    setCrisisRegion("global");
    setAnalysisPrompt(null);
    setIsOnboarding(false);
    setIsCrisisActive(false);
    setCrisisSeverity("");
    if (crisisTimerRef.current) {
      clearTimeout(crisisTimerRef.current);
      crisisTimerRef.current = null;
    }
  };

  const handleVaultUnlocked = (status: main.VaultStatus) => {
    setVaultStatus(status);
    setActiveView("home");
  };

  const handleVaultLocked = () => {
    clearSensitiveState();
    setVaultStatus({ configured: true, unlocked: false } as main.VaultStatus);
  };

  const handleSelectEntry = (entry: main.Entry) => {
    setCurrentEntryId(entry.id);
    currentEntryIdRef.current = entry.id;
    setEntryTitle(entry.title);
    setJournalText(entry.content);
    journalTextRef.current = entry.content;
    if (entry.emotions && entry.emotions.length > 0) {
      setAiResponse({ emotions: entry.emotions, coaching: entry.coaching || "" });
      setAnalyzedText(entry.content);
    } else {
      setAiResponse(null);
      setAnalyzedText("");
    }
    setActiveView("write");
  };

  // render the active view
  const renderContent = () => {
    if (isOnboarding) {
      return (
        <Onboarding onComplete={() => {
          setIsOnboarding(false);
          setActiveView("home");
        }} />
      );
    }

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
        return <HistoryList entries={history} onSelectEntry={handleSelectEntry} onCreateEntry={handleNewEntry} />;

      case "home":
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        const greeting = displayName ? `${timeGreeting}, ${displayName}.` : `${timeGreeting}.`;
        const recentEntries = history.slice(0, 3);
        const entriesThisWeek = getEntriesThisWeek(history);
        const entriesThisMonth = getEntriesThisMonth(history);

        return (
          <div className="page-shell enter-soft">
            <section className="app-panel-strong rounded-[32px] p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-6">
                <div className="grid gap-5 lg:grid-cols-2 lg:items-center">
                  <div className="order-2 flex flex-col gap-4 lg:order-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="metric-card">
                        <span className="metric-label">Entries</span>
                        <span className="metric-value">{history.length}</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">This Week</span>
                        <span className="metric-value">{entriesThisWeek}</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">This Month</span>
                        <span className="metric-value">{entriesThisMonth}</span>
                      </div>
                    </div>
                  </div>

                  <div className="order-1 space-y-5 lg:order-1">
                    <p className="eyebrow">Daily Reflection</p>
                    <h2 className="page-title max-w-3xl">{greeting}</h2>

                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setActiveView("write")} className="action-primary">
                        <PenTool size={16} />
                        Start writing
                      </button>
                      <button onClick={() => setActiveView("history")} className="action-secondary">
                        <HistoryIcon size={16} />
                        Browse history
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Heatmap entries={history} />
                  <MoodLineChart entries={history} />
                </div>

                <div className="app-panel rounded-[28px] p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="icon-badge h-11 w-11 rounded-[1rem]">
                      <Calendar size={18} />
                    </span>
                    <div>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">Recent Entries</h3>
                    </div>
                  </div>

                  {recentEntries.length > 0 ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {recentEntries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => handleSelectEntry(entry)}
                          className="w-full rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.82)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-[var(--text)]">
                              {entry.title || "Untitled entry"}
                            </span>
                            <span className="shrink-0 text-xs text-[var(--muted)]">
                              {new Date(entry.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                            {entry.preview || "Open entry"}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[22px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.42)] p-5">
                      <p className="text-sm leading-7 text-[var(--muted)]">No entries yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      case "settings":
        return <Settings onLock={handleVaultLocked} />;
      default:
        return <div className="p-10 text-center text-gray-500">Work in Progress</div>;
    }
  };

  if (!vaultStatus?.unlocked) {
    return <VaultGate initialStatus={vaultStatus} onUnlocked={handleVaultUnlocked} />;
  }

  return (
    <>
      {/* Crisis overlay */}
      {isCrisisActive && (
        <CrisisScreen
          severity={crisisSeverity}
          region={crisisRegion}
          onDismiss={handleCrisisDismiss}
        />
      )}

      {analysisPrompt && (
        <AnalyzePromptToast
          onAnalyze={handleAnalyzeSavedEntry}
          onDismiss={() => setAnalysisPrompt(null)}
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
              modelName={modelName}
              emotionModel={emotionModel}
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
