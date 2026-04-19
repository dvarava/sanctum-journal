import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Brain, Gauge, Cpu, User, Shield, Check, FolderOpen } from 'lucide-react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

const coachingStyles = [
    {
        id: 'compassionate',
        label: 'Compassionate',
        description: 'Warm and validating',
        emoji: '💛',
    },
    {
        id: 'direct',
        label: 'Direct',
        description: 'Clear and concise',
        emoji: '🎯',
    },
    {
        id: 'socratic',
        label: 'Socratic',
        description: 'Question-led',
        emoji: '🧠',
    },
    {
        id: 'motivational',
        label: 'Motivational',
        description: 'Upbeat and energising',
        emoji: '🔥',
    },
];

const availableModels = [
    { id: 'qwen3:4b', label: 'Qwen3 4B', description: 'Balanced' },
    { id: 'qwen3:1.7b', label: 'Qwen3 1.7B', description: 'Lightweight' },
    { id: 'qwen3:30b-a3b', label: 'Qwen3 30B MoE', description: 'Largest local option' },
    { id: 'qwen3:8b', label: 'Qwen3 8B', description: 'Higher quality' },
    { id: 'gemma:2b', label: 'Gemma 2B', description: 'Fastest legacy option' },
    { id: 'mistral', label: 'Mistral 7B', description: 'Strong general model' },
];

const emoModels = [
    { id: 'default', label: 'Use Base Model', description: 'Single model' },
    { id: 'emollm:7b', label: 'EmoLLM 7B', description: 'Emotion-specific' },
];

export function Settings() {
    const [coachingStyle, setCoachingStyle] = useState('compassionate');
    const [analysisDepth, setAnalysisDepth] = useState('brief');
    const [modelName, setModelName] = useState('gemma:2b');
    const [emotionModel, setEmotionModel] = useState('default');
    const [userName, setUserName] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // load settings on mount
    useEffect(() => {
        (async () => {
            try {
                const s = await GetSettings();
                setCoachingStyle(s.coaching_style || 'compassionate');
                setAnalysisDepth(s.analysis_depth || 'brief');
                setModelName(s.model_name || 'gemma:2b');
                setEmotionModel(s.emotion_model || 'default');
                setUserName(s.user_name || '');
            } catch { }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        await SaveSettings(coachingStyle, analysisDepth, modelName, emotionModel, userName, true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) {
        return (
            <div className="page-shell">
                <div className="app-panel-strong flex min-h-[260px] items-center justify-center rounded-[32px]">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell enter-soft">
            <div className="flex flex-col gap-6">
                <section className="app-panel-strong rounded-[32px] p-6 sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex items-start gap-4">
                    
                            <div className="max-w-2xl">
                                <p className="eyebrow">Preferences</p>
                                <h2 className="page-title mt-3">Shape the tone of your journal</h2>
                            </div>
                        </div>

                        <button onClick={handleSave} className={saved ? "action-secondary" : "action-primary"}>
                            {saved ? "Settings saved" : "Save settings"}
                        </button>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <section className="app-panel rounded-[30px] p-6">
                        <div className="flex items-center gap-3">
                            <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                <User size={18} />
                            </span>
                            <div>
                                <p className="eyebrow">Profile</p>
                                <h3 className="text-xl font-semibold text-[var(--text)]">Personal details</h3>
                            </div>
                        </div>

                        <div className="mt-5">
                            <label className="eyebrow">Display Name</label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="Enter your name for personalized greetings"
                                className="soft-input mt-2"
                            />
                        </div>

                        <div className="mt-8">
                            <div className="flex items-center gap-3">
                                <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                    <Brain size={18} />
                                </span>
                                <div>
                                    <p className="eyebrow">Coaching Style</p>
                                </div>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {coachingStyles.map((style) => (
                                    <button
                                        key={style.id}
                                        onClick={() => setCoachingStyle(style.id)}
                                        className={`rounded-[24px] border p-4 text-left transition-all ${
                                            coachingStyle === style.id
                                                ? "border-[rgba(93,117,99,0.26)] bg-[rgba(238,244,238,0.92)] shadow-[0_16px_30px_rgba(65,82,71,0.08)]"
                                                : "border-[var(--line)] bg-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.84)]"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--text)]">{style.label}</p>
                                                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                                    {style.description}
                                                </p>
                                            </div>
                                            {coachingStyle === style.id && (
                                                <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="app-panel rounded-[30px] p-6">
                            <div className="flex items-center gap-3">
                                <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                    <Gauge size={18} />
                                </span>
                                <div>
                                    <p className="eyebrow">Analysis</p>
                                    <h3 className="text-xl font-semibold text-[var(--text)]">Depth</h3>
                                </div>
                            </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button
                                onClick={() => setAnalysisDepth("brief")}
                                className={`rounded-[24px] border p-4 text-left transition-all ${
                                    analysisDepth === "brief"
                                        ? "border-[rgba(93,117,99,0.26)] bg-[rgba(238,244,238,0.92)] shadow-[0_16px_30px_rgba(65,82,71,0.08)]"
                                        : "border-[var(--line)] bg-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.84)]"
                                }`}
                            >
                                <p className="text-sm font-semibold text-[var(--text)]">Brief</p>
                                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                    One concise cognitive reframe.
                                </p>
                            </button>

                            <button
                                onClick={() => setAnalysisDepth("detailed")}
                                className={`rounded-[24px] border p-4 text-left transition-all ${
                                    analysisDepth === "detailed"
                                        ? "border-[rgba(93,117,99,0.26)] bg-[rgba(238,244,238,0.92)] shadow-[0_16px_30px_rgba(65,82,71,0.08)]"
                                        : "border-[var(--line)] bg-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.84)]"
                                }`}
                            >
                                <p className="text-sm font-semibold text-[var(--text)]">Detailed</p>
                                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                    A fuller reflection with suggestions and nuance.
                                </p>
                            </button>
                        </div>

                        <div className="app-panel-muted mt-8 rounded-[28px] p-5">
                            <p className="eyebrow">Current</p>
                            <p className="mt-3 text-lg font-semibold text-[var(--text)]">
                                {analysisDepth === "brief" ? "Short reframe" : "Longer reflection"}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
                                {analysisDepth === "brief"
                                    ? "A quicker response after each analysis."
                                    : "More context and a fuller response."}
                            </p>
                        </div>
                    </section>

                    <section className="app-panel rounded-[30px] p-6 xl:col-span-2">
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                        <Cpu size={18} />
                                    </span>
                                    <div>
                                        <p className="eyebrow">Primary Model</p>
                                        <h3 className="text-xl font-semibold text-[var(--text)]">AI setup</h3>
                                    </div>
                                </div>

                                <div className="mt-5 flex flex-col gap-3">
                                    {availableModels.map((model) => (
                                        <button
                                            key={model.id}
                                            onClick={() => setModelName(model.id)}
                                            className={`rounded-[24px] border p-4 text-left transition-all ${
                                                modelName === model.id
                                                    ? "border-[rgba(93,117,99,0.26)] bg-[rgba(238,244,238,0.92)] shadow-[0_16px_30px_rgba(65,82,71,0.08)]"
                                                    : "border-[var(--line)] bg-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.84)]"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-mono text-sm font-semibold text-[var(--text)]">
                                                        {model.label}
                                                    </p>
                                                    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                                        {model.description}
                                                    </p>
                                                </div>
                                                {modelName === model.id && (
                                                    <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
                                    Install with <code className="rounded bg-[rgba(255,255,255,0.72)] px-1.5 py-0.5">ollama pull {modelName}</code>
                                </p>
                            </div>

                            <div className="flex flex-col gap-5">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="icon-badge h-11 w-11 rounded-[1rem] bg-[linear-gradient(145deg,rgba(128,151,171,0.22),rgba(255,255,255,0.46))]">
                                            <Brain size={18} />
                                        </span>
                                        <div>
                                            <p className="eyebrow">Emotion Model</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-col gap-3">
                                        {emoModels.map((model) => (
                                            <button
                                                key={model.id}
                                                onClick={() => setEmotionModel(model.id)}
                                                className={`rounded-[24px] border p-4 text-left transition-all ${
                                                    emotionModel === model.id
                                                        ? "border-[rgba(118,136,154,0.22)] bg-[rgba(233,240,245,0.92)] shadow-[0_16px_30px_rgba(67,83,96,0.08)]"
                                                        : "border-[var(--line)] bg-[rgba(255,255,255,0.62)] hover:bg-[rgba(255,255,255,0.84)]"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-mono text-sm font-semibold text-[var(--text)]">
                                                            {model.label}
                                                        </p>
                                                        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                                            {model.description}
                                                        </p>
                                                    </div>
                                                    {emotionModel === model.id && (
                                                        <Check size={16} className="mt-0.5 shrink-0 text-[#4d6475]" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="app-panel-muted rounded-[28px] p-5">
                                    <div className="flex items-start gap-3">
                                        <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                            <Shield size={18} />
                                        </span>
                                        <div>
                                            <p className="eyebrow">PRIVACY</p>
                                            <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--muted-strong)]">
                                                <p className="flex items-center gap-2">
                                                    <Check size={14} className="text-[var(--accent-strong)]" />
                                                    AES-256-GCM
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <Check size={14} className="text-[var(--accent-strong)]" />
                                                    No telemetry
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <FolderOpen size={14} className="text-[var(--accent-strong)]" />
                                                    ~/Library/Application Support/Sanctum/
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
}
