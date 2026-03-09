import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Brain, Gauge, Cpu, User, Shield, Check, FolderOpen } from 'lucide-react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

const coachingStyles = [
    {
        id: 'compassionate',
        label: 'Compassionate',
        description: 'Warm, empathetic, validates feelings before reframing',
        emoji: '💛',
    },
    {
        id: 'direct',
        label: 'Direct',
        description: 'Concise, honest, actionable insight without sugar-coating',
        emoji: '🎯',
    },
    {
        id: 'socratic',
        label: 'Socratic',
        description: 'Thought-provoking questions that help you discover your own insight',
        emoji: '🧠',
    },
    {
        id: 'motivational',
        label: 'Motivational',
        description: 'Energising, uplifting, focused on strengths and growth',
        emoji: '🔥',
    },
];

const availableModels = [
    { id: 'qwen3:4b', label: 'Qwen3 4B', description: 'Best balance of quality and speed (recommended, ~4GB RAM)' },
    { id: 'qwen3:1.7b', label: 'Qwen3 1.7B', description: 'Fast and lightweight (~2GB RAM)' },
    { id: 'qwen3:30b-a3b', label: 'Qwen3 30B MoE', description: 'Near cloud-quality, 30B knowledge in ~4GB RAM' },
    { id: 'qwen3:8b', label: 'Qwen3 8B', description: 'Strong reasoning, needs 8GB+ free RAM' },
    { id: 'gemma:2b', label: 'Gemma 2B', description: 'Legacy — fast but lower quality (~2GB RAM)' },
    { id: 'mistral', label: 'Mistral 7B', description: 'Strong reasoning, needs 8GB+ free RAM' },
];

export function Settings() {
    const [coachingStyle, setCoachingStyle] = useState('compassionate');
    const [analysisDepth, setAnalysisDepth] = useState('brief');
    const [modelName, setModelName] = useState('gemma:2b');
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
                setUserName(s.user_name || '');
            } catch { }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        await SaveSettings(coachingStyle, analysisDepth, modelName, userName, true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto animate-in fade-in duration-500 overflow-y-auto h-full">
            <div className="flex items-center gap-3 mb-8">
                <SettingsIcon size={24} className="text-accent" />
                <h2 className="text-2xl font-serif text-white/90">Settings</h2>
            </div>

            {/* User Name */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <User size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Your Name</h3>
                </div>
                <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name for personalised greetings"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:border-accent/50 transition-colors"
                />
            </section>

            {/* Coaching Style */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <Brain size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Coaching Style</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {coachingStyles.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setCoachingStyle(style.id)}
                            className={`p-4 rounded-xl text-left transition-all border ${coachingStyle === style.id
                                ? 'bg-accent/10 border-accent/40 shadow-[0_0_15px_rgba(45,212,191,0.15)]'
                                : 'bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{style.emoji}</span>
                                <span className={`font-medium text-sm ${coachingStyle === style.id ? 'text-accent' : 'text-white/90'}`}>
                                    {style.label}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">{style.description}</p>
                        </button>
                    ))}
                </div>
            </section>

            {/* Analysis Depth */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <Gauge size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Analysis Depth</h3>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setAnalysisDepth('brief')}
                        className={`flex-1 p-4 rounded-xl text-left transition-all border ${analysisDepth === 'brief'
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                            }`}
                    >
                        <span className={`font-medium text-sm ${analysisDepth === 'brief' ? 'text-accent' : 'text-white/90'}`}>Brief</span>
                        <p className="text-xs text-gray-400 mt-1">One-line cognitive reframe</p>
                    </button>
                    <button
                        onClick={() => setAnalysisDepth('detailed')}
                        className={`flex-1 p-4 rounded-xl text-left transition-all border ${analysisDepth === 'detailed'
                            ? 'bg-accent/10 border-accent/40'
                            : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                            }`}
                    >
                        <span className={`font-medium text-sm ${analysisDepth === 'detailed' ? 'text-accent' : 'text-white/90'}`}>Detailed</span>
                        <p className="text-xs text-gray-400 mt-1">Multi-sentence coaching with suggestions</p>
                    </button>
                </div>
            </section>

            {/* Model Selector */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <Cpu size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">AI Model</h3>
                </div>
                <div className="flex flex-col gap-2">
                    {availableModels.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => setModelName(model.id)}
                            className={`flex items-center justify-between p-3 rounded-xl transition-all border ${modelName === model.id
                                ? 'bg-accent/10 border-accent/40'
                                : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                                }`}
                        >
                            <div>
                                <span className={`font-mono text-sm ${modelName === model.id ? 'text-accent' : 'text-white/90'}`}>
                                    {model.label}
                                </span>
                                <p className="text-xs text-gray-500">{model.description}</p>
                            </div>
                            {modelName === model.id && <Check size={16} className="text-accent" />}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                    Model must be installed via Ollama. Run: <code className="text-gray-400">ollama pull {modelName}</code>
                </p>
            </section>

            {/* Privacy Info */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <Shield size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Privacy</h3>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Shield size={14} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-emerald-200 font-medium">All data stays on your device</p>
                            <ul className="text-xs text-gray-400 mt-2 space-y-1">
                                <li className="flex items-center gap-2">
                                    <Check size={10} className="text-emerald-500 shrink-0" />
                                    Entries encrypted with AES-256-GCM
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check size={10} className="text-emerald-500 shrink-0" />
                                    AI analysis runs locally via Ollama
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check size={10} className="text-emerald-500 shrink-0" />
                                    No telemetry, no external API calls
                                </li>
                                <li className="flex items-center gap-2">
                                    <FolderOpen size={10} className="text-emerald-500 shrink-0" />
                                    Database location: ~/Library/Application Support/Sanctum/
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* AI Disclaimer */}
            <p className="text-[10px] text-center text-gray-500/60 mb-6 select-none">
                Generated by AI · Sanctum is for self-reflection, not a substitute for professional medical advice.
            </p>

            {/* Save Button */}
            <button
                onClick={handleSave}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${saved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
                    }`}
            >
                {saved ? '✓ Saved' : 'Save Settings'}
            </button>
        </div>
    );
}
