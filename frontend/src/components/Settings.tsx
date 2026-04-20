import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Brain, Gauge, Cpu, User, Shield, Check, FolderOpen, Download, AlertTriangle, KeyRound, Lock } from 'lucide-react';
import { CancelPullModel, ChangeVaultPassword, GetSettings, IsOllamaRunning, ListModels, LockVault, PullModel, SaveSettings } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface SettingsProps {
    onLock?: () => void;
}

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
    { id: 'guanxin/emollm:latest', label: 'EmoLLM 7B', description: 'Emotion-specific' },
];

type PullProgressEvent = {
    model?: string;
    status?: string;
    total?: number;
    completed?: number;
    error?: string;
};

const modelAliases: Record<string, string> = {
    "emollm:7b": "guanxin/emollm:latest",
    "emollm:latest": "guanxin/emollm:latest",
};

const canonicalModelName = (modelName: string) => {
    const trimmed = modelName.trim();
    return modelAliases[trimmed.toLowerCase()] || trimmed;
};

const normalizeModelName = (modelName: string) => canonicalModelName(modelName).replace(/:latest$/, "");

const modelIsInstalled = (models: string[], modelName: string) => {
    if (!modelName || modelName === "default") return true;
    const target = normalizeModelName(modelName);
    return models.some((model) => normalizeModelName(model) === target);
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const formatPullStatus = (status: string) => {
    switch (status) {
        case "canceled":
            return "Download canceled.";
        case "pulling manifest":
            return "Finding the model manifest...";
        case "verifying sha256 digest":
            return "Verifying model files...";
        case "writing manifest":
            return "Writing model manifest...";
        case "removing any unused layers":
            return "Cleaning up old model files...";
        case "success":
            return "Model download complete. Checking installation...";
        default:
            if (status.startsWith("pulling ")) return "Downloading model files...";
            return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

const getErrorMessage = (error: unknown) => {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    return String(error);
};

const isCancelError = (message: string) => {
    const normalized = message.toLowerCase();
    return normalized.includes("canceled") || normalized.includes("cancelled") || normalized.includes("context canceled");
};

const modelPillClass = "pill-chip min-w-[7.5rem] justify-center";
const compactModelButtonClass = `${modelPillClass} bg-[rgba(255,255,255,0.72)] text-[var(--accent-strong)] transition-all hover:bg-[rgba(255,255,255,0.9)] disabled:cursor-not-allowed disabled:opacity-55`;
const installModelButtonClass = `${modelPillClass} border-[rgba(65,82,71,0.2)] bg-[#415247] !text-[#f8f7f2] !shadow-none transition-all hover:bg-[#536b59] disabled:cursor-not-allowed disabled:opacity-100 [&_svg]:!text-[#f8f7f2]`;

export function Settings({ onLock }: SettingsProps) {
    const [coachingStyle, setCoachingStyle] = useState('compassionate');
    const [analysisDepth, setAnalysisDepth] = useState('brief');
    const [modelName, setModelName] = useState('gemma:2b');
    const [emotionModel, setEmotionModel] = useState('default');
    const [userName, setUserName] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
    const [installedModels, setInstalledModels] = useState<string[]>([]);
    const [checkingModels, setCheckingModels] = useState(false);
    const [installingModel, setInstallingModel] = useState("");
    const [cancelingModel, setCancelingModel] = useState("");
    const [installFeedbackModel, setInstallFeedbackModel] = useState("");
    const [installStatus, setInstallStatus] = useState("");
    const [installProgress, setInstallProgress] = useState<number | null>(null);
    const [installError, setInstallError] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordFeedback, setPasswordFeedback] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [lockingVault, setLockingVault] = useState(false);

    const refreshModelStatus = useCallback(async () => {
        setCheckingModels(true);
        try {
            const isRunning = await IsOllamaRunning();
            setOllamaRunning(isRunning);

            if (isRunning) {
                const models = await ListModels();
                setInstalledModels(models || []);
            } else {
                setInstalledModels([]);
            }
        } catch (e) {
            console.error("Failed checking Ollama", e);
            setOllamaRunning(false);
            setInstalledModels([]);
        } finally {
            setCheckingModels(false);
        }
    }, []);

    const waitForModelToAppear = async (targetModel: string) => {
        let latestModels: string[] = [];

        for (let attempt = 0; attempt < 10; attempt += 1) {
            latestModels = (await ListModels()) || [];
            if (modelIsInstalled(latestModels, targetModel)) return latestModels;
            if (attempt < 9) await sleep(1000);
        }

        return latestModels;
    };

    // load settings on mount
    useEffect(() => {
        (async () => {
            try {
                const s = await GetSettings();
                setCoachingStyle(s.coaching_style || 'compassionate');
                setAnalysisDepth(s.analysis_depth || 'brief');
                setModelName(canonicalModelName(s.model_name || 'gemma:2b'));
                setEmotionModel(canonicalModelName(s.emotion_model || 'default'));
                setUserName(s.user_name || '');
            } catch { }
            await refreshModelStatus();
            setLoading(false);
        })();
    }, [refreshModelStatus]);

    useEffect(() => {
        const unsubscribe = EventsOn("ollama:pull-progress", (event: PullProgressEvent) => {
            if (!event || event.model !== installingModel) return;

            if (event.error) {
                setInstallStatus(event.error);
                return;
            }

            if (event.status) {
                setInstallStatus(formatPullStatus(event.status));
            }

            if (event.total && event.total > 0 && typeof event.completed === "number") {
                setInstallProgress(Math.min(100, Math.round((event.completed / event.total) * 100)));
            }
        });

        return unsubscribe;
    }, [installingModel]);

    const handleSave = async () => {
        await SaveSettings(coachingStyle, analysisDepth, modelName, emotionModel, userName, true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleChangePassword = async () => {
        setPasswordFeedback("");
        if (newPassword !== confirmNewPassword) {
            setPasswordFeedback("New passwords do not match.");
            return;
        }
        if (newPassword.length < 10) {
            setPasswordFeedback("New password must be at least 10 characters.");
            return;
        }

        setChangingPassword(true);
        try {
            const result = await ChangeVaultPassword(currentPassword, newPassword, confirmNewPassword);
            setPasswordFeedback(result.message || "");
            if (result.success) {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
            }
        } catch (e) {
            setPasswordFeedback(getErrorMessage(e));
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLockVault = async () => {
        setPasswordFeedback("");
        setLockingVault(true);
        try {
            const result = await LockVault();
            if (result.success) {
                onLock?.();
                return;
            }
            setPasswordFeedback(result.message || "Could not lock Sanctum.");
        } catch (e) {
            setPasswordFeedback(getErrorMessage(e));
        } finally {
            setLockingVault(false);
        }
    };

    const handleInstallModel = async (targetModel: string) => {
        if (!targetModel || targetModel === "default" || installingModel) return;

        setInstallingModel(targetModel);
        setInstallFeedbackModel(targetModel);
        setInstallError("");
        setInstallProgress(null);
        setInstallStatus("Starting model download...");
        setCancelingModel("");

        try {
            const isRunning = await IsOllamaRunning();
            setOllamaRunning(isRunning);

            if (!isRunning) {
                setInstallError("Ollama is not running. Start Ollama, then try again.");
                return;
            }

            await PullModel(targetModel);

            setInstallStatus("Checking installed models...");
            const models = await waitForModelToAppear(targetModel);
            setInstalledModels(models);

            if (modelIsInstalled(models, targetModel)) {
                setInstallStatus(`${targetModel} is installed. Save settings to use it.`);
            } else {
                setInstallError(`Download finished, but ${targetModel} did not appear in Ollama's model list yet. Click "Check models" to refresh.`);
            }
        } catch (e) {
            const message = getErrorMessage(e);
            if (isCancelError(message)) {
                setInstallStatus("Download canceled.");
                return;
            }
            setInstallError(message || "Failed to install model.");
        } finally {
            setInstallingModel("");
            setCancelingModel("");
        }
    };

    const handleCancelInstall = async (targetModel: string) => {
        if (!targetModel || !installingModel || cancelingModel) return;

        setCancelingModel(targetModel);
        setInstallStatus("Canceling download...");

        try {
            const canceled = await CancelPullModel(targetModel);
            if (!canceled) {
                setInstallStatus("Cancel request sent.");
            }
        } catch (e) {
            setInstallError(getErrorMessage(e) || "Could not cancel download.");
            setCancelingModel("");
        }
    };

    const renderModelInstallPanel = (targetModel: string, label: string) => {
        if (!targetModel || targetModel === "default") {
            return (
                <div className="app-panel-muted rounded-[24px] p-4 text-sm leading-7 text-[var(--muted-strong)]">
                    The base model will handle emotion analysis.
                </div>
            );
        }

        const isInstalled = modelIsInstalled(installedModels, targetModel);
        const isInstalling = installingModel === targetModel;

        return (
            <div className="app-panel-muted rounded-[24px] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                        <p className="mt-1 text-xs leading-6 text-[var(--muted-strong)]">
                            {ollamaRunning === false
                                ? "Ollama is not running."
                                : isInstalled
                                    ? "Installed in Ollama."
                                    : `Install ${targetModel} from Ollama.`}
                        </p>
                    </div>

                    {isInstalled ? (
                        <span className={`${modelPillClass} bg-[rgba(238,244,238,0.92)] text-[var(--accent-strong)]`}>
                            <Check size={14} />
                            Installed
                        </span>
                    ) : ollamaRunning === false ? (
                        <button type="button" onClick={refreshModelStatus} disabled={checkingModels} className={compactModelButtonClass}>
                            Check models
                        </button>
                    ) : isInstalling ? (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                            <button type="button" disabled className={installModelButtonClass}>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f8f7f2] border-t-transparent" />
                                Installing...
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCancelInstall(targetModel)}
                                disabled={cancelingModel === targetModel}
                                className={compactModelButtonClass}
                            >
                                {cancelingModel === targetModel ? "Canceling..." : "Cancel"}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleInstallModel(targetModel)}
                            disabled={isInstalling || Boolean(installingModel) || checkingModels}
                            className={installModelButtonClass}
                        >
                            <Download size={14} />
                            Install
                        </button>
                    )}
                </div>

                {isInstalling && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-[var(--muted-strong)]">
                                {installStatus || "Downloading model files..."}
                            </p>
                            {installProgress !== null && (
                                <p className="text-xs font-semibold text-[var(--muted)]">{installProgress}%</p>
                            )}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(93,117,99,0.14)]">
                            <div
                                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                                style={{ width: `${installProgress ?? 18}%` }}
                            />
                        </div>
                    </div>
                )}

                {installFeedbackModel === targetModel && installError && (
                    <div className="mt-4 rounded-[20px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.86)] p-4 text-sm leading-7 text-[#8a5f42]">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-1 shrink-0 text-[#9a5d4d]" size={18} />
                            <div>
                                <p>{installError}</p>
                                <button type="button" onClick={refreshModelStatus} className="action-secondary mt-3 inline-flex">
                                    Check models
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {installFeedbackModel === targetModel && installStatus && !installingModel && !installError && (
                    <div className="mt-4 rounded-[20px] border border-[rgba(93,117,99,0.16)] bg-[rgba(238,244,238,0.92)] p-4 text-sm leading-7 text-[var(--accent-strong)]">
                        {installStatus}
                    </div>
                )}
            </div>
        );
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

                                <div className="mt-4 flex flex-col gap-3">
                                    {checkingModels ? (
                                        <div className="app-panel-muted rounded-[24px] p-4">
                                            <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted-strong)]">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                                Checking installed models...
                                            </div>
                                        </div>
                                    ) : (
                                        renderModelInstallPanel(modelName, "Selected primary model")
                                    )}
                                </div>
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

                                {emotionModel !== "default" && (
                                    <div>
                                        {renderModelInstallPanel(emotionModel, "Selected emotion model")}
                                    </div>
                                )}

                                <div className="app-panel-muted rounded-[28px] p-5">
                                    <div className="flex items-start gap-3">
                                        <span className="icon-badge h-11 w-11 rounded-[1rem]">
                                            <KeyRound size={18} />
                                        </span>
                                        <div className="flex-1">
                                            <p className="eyebrow">Password</p>
                                            <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">Vault access</h3>

                                            <div className="mt-4 flex flex-col gap-3">
                                                <input
                                                    type="password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    placeholder="Current password"
                                                    className="soft-input"
                                                    autoComplete="current-password"
                                                />
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="New password"
                                                    className="soft-input"
                                                    autoComplete="new-password"
                                                />
                                                <input
                                                    type="password"
                                                    value={confirmNewPassword}
                                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                    placeholder="Confirm new password"
                                                    className="soft-input"
                                                    autoComplete="new-password"
                                                />
                                            </div>

                                            {passwordFeedback && (
                                                <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-4 text-sm leading-7 text-[var(--muted-strong)]">
                                                    {passwordFeedback}
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                                <button
                                                    type="button"
                                                    onClick={handleChangePassword}
                                                    disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                                    className="action-primary justify-center disabled:cursor-not-allowed disabled:opacity-55"
                                                >
                                                    {changingPassword ? (
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f8f7f2] border-t-transparent" />
                                                    ) : (
                                                        <KeyRound size={16} />
                                                    )}
                                                    {changingPassword ? "Changing..." : "Change password"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={handleLockVault}
                                                    disabled={lockingVault}
                                                    className="action-secondary justify-center disabled:cursor-not-allowed disabled:opacity-55"
                                                >
                                                    {lockingVault ? (
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                                    ) : (
                                                        <Lock size={16} />
                                                    )}
                                                    {lockingVault ? "Locking..." : "Lock now"}
                                                </button>
                                            </div>
                                        </div>
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
