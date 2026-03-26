import { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, History as HistoryIcon, PenTool, ShieldCheck } from "lucide-react";
import { SaveEntry, AnalyzeJournal, AnalyzeJournalCloud, GetEntries, DeleteEntry, CheckCrisisMarkers, GetSettings } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { Layout } from "./components/Layout";
import { Editor } from "./components/Editor";
import { AIPanel } from "./components/AIPanel";
import { HistoryList } from "./components/HistoryList";
import { Heatmap } from "./components/Heatmap";
import { MoodLineChart } from "./components/MoodLineChart";
import { CrisisScreen } from "./components/CrisisScreen";
import { Settings } from "./components/Settings";
import { InsightToast } from "./components/InsightToast";
import { Onboarding } from "./components/Onboarding";

interface AnalysisResult {
  emotions: string[];
  coaching: string;
}

const getEntriesThisWeek = (entries: main.Entry[]) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);

  return entries.filter((entry) => new Date(entry.created_at) >= weekAgo).length;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [isOnboarding, setIsOnboarding] = useState(false);

  // auto-coaching insight
  const [pendingInsight, setPendingInsight] = useState<AnalysisResult | null>(null);
  const [pendingInsightContext, setPendingInsightContext] = useState<{ text: string; title: string } | null>(null);

  // crisis state
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [crisisSeverity, setCrisisSeverity] = useState("");
  const crisisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // history state
  const [history, setHistory] = useState<main.Entry[]>([]);

  // user display name
  const [displayName, setDisplayName] = useState("");

  // load history + settings on mount and when navigating views
  useEffect(() => {
    refreshHistory();
    loadDisplayNameAndOnboarding();
  }, [activeView]);

  const loadDisplayNameAndOnboarding = async () => {
    try {
      const s = await GetSettings();
      setDisplayName(s.user_name || "");
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

    // capture text and title before clearing editor
    const textToAnalyze = journalText;
    const savedTitle = entryTitle;

    // simulate a brief delay for visual feedback of "Encrypting"
    await new Promise(r => setTimeout(r, 800));

    // pass detected emotions if available
    const emotionsToSave = aiResponse?.emotions || [];

    await SaveEntry(currentEntryId, entryTitle, journalText, emotionsToSave, aiResponse?.coaching || "");
    await refreshHistory();

    // reset editor for new entry
    setJournalText("");
    setEntryTitle("");
    setAiResponse(null);
    setCurrentEntryId(0);
    setIsSaving(false);

    // background auto-coaching — fire and forget, don't block the UI
    if (textToAnalyze.length >= 20 && !isCrisisActive) {
      AnalyzeJournal(textToAnalyze)
        .then((result) => {
          if (result.coaching && !result.emotions?.includes("Crisis Detected")) {
            setPendingInsight(result);
            setPendingInsightContext({ text: textToAnalyze, title: savedTitle });
          }
        })
        .catch(() => { }); // silently fail — auto-coaching is supplementary
    }
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
      setAiResponse({ emotions: entry.emotions, coaching: entry.coaching || "" });
    } else {
      setAiResponse(null);
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
        return <HistoryList entries={history} onSelectEntry={handleSelectEntry} />;

      case "home":
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        const greeting = displayName ? `${timeGreeting}, ${displayName}.` : `${timeGreeting}.`;
        const recentEntries = history.slice(0, 3);
        const entriesThisWeek = getEntriesThisWeek(history);

        return (
          <div className="page-shell enter-soft">
            <section className="app-panel-strong rounded-[32px] p-6 sm:p-8 lg:p-10">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="flex flex-col gap-6">
                  <div className="space-y-5">
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

                  <div className="flex flex-wrap gap-3">
                    <div className="metric-card">
                      <span className="metric-label">Entries</span>
                      <span className="metric-value">{history.length}</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">This Week</span>
                      <span className="metric-value">{entriesThisWeek}</span>
                    </div>
                    <div className="pill-chip bg-[rgba(255,255,255,0.62)]">
                      <ShieldCheck size={14} className="text-[var(--accent-strong)]" />
                      Local-first
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <Heatmap entries={history} />
                    <MoodLineChart entries={history} />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
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
                      <div className="mt-5 space-y-3">
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
                              <span className="text-xs text-[var(--muted)]">
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
              </div>
            </section>
          </div>
        );
      case "settings":
        return <Settings />;
      default:
        return <div className="p-10 text-center text-gray-500">Work in Progress</div>;
    }
  };

  return (
    <>
      {/* Crisis overlay */}
      {isCrisisActive && (
        <CrisisScreen
          severity={crisisSeverity}
          onDismiss={handleCrisisDismiss}
        />
      )}

      {/* Auto-coaching insight toast */}
      {pendingInsight && (
        <InsightToast
          emotions={pendingInsight.emotions}
          coaching={pendingInsight.coaching}
          onExpand={() => {
            if (pendingInsightContext) {
              setJournalText(pendingInsightContext.text);
              setEntryTitle(pendingInsightContext.title);
            }
            setAiResponse(pendingInsight);
            setPendingInsight(null);
            setPendingInsightContext(null);
            setActiveView("write");
          }}
          onDismiss={() => {
            setPendingInsight(null);
            setPendingInsightContext(null);
          }}
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
