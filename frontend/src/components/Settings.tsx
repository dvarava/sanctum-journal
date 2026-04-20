import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Brain, Check, Cpu, Download, KeyRound, Lock, Settings as SettingsIcon, Shield } from 'lucide-react';
import { CancelPullModel, ChangeVaultPassword, GetAnalysisAudit, GetSanctumDirectory, GetSettings, IsOllamaRunning, ListModels, LockVault, PullModel, SaveSettings } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { main } from '../../wailsjs/go/models';

interface SettingsProps {
    onLock?: () => void;
}

const coachingStyles = [
    { id: 'compassionate', label: 'Compassionate', description: 'Warm and validating' },
    { id: 'direct', label: 'Direct', description: 'Clear and concise' },
    { id: 'socratic', label: 'Socratic', description: 'Question-led' },
    { id: 'motivational', label: 'Motivational', description: 'Upbeat and energising' },
];

const analysisDepths = [
    { id: 'brief', label: 'Brief', description: 'One concise reframe' },
    { id: 'detailed', label: 'Detailed', description: 'More context and nuance' },
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

const crisisRegions = [
    { id: 'global', label: 'Global', description: 'International directory' },
    { id: 'us', label: 'United States', description: '988 & text support' },
    { id: 'uk_ie', label: 'UK / Ireland', description: 'Samaritans & global directory' },
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

const compactOptionClass = (selected: boolean) =>
    `flex min-h-11 w-full items-center justify-between gap-2 rounded-[20px] border px-3 py-2 text-left transition-colors ${
        selected
            ? "border-[var(--accent)] bg-white"
            : "border-[var(--line)] bg-transparent hover:bg-[rgba(255,255,255,0.55)]"
    }`;

const sectionClass = "border-t border-[var(--line)] px-5 py-5 sm:px-6";
const fieldRowClass = "grid gap-2 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-start";
const selectClass = "soft-input min-h-11 py-2.5 text-sm";

function SettingsSection({ icon, title, note, children }: { icon: React.ReactNode; title: string; note?: string; children: React.ReactNode }) {
    return (
        <section className={sectionClass}>
            <div className="mb-4 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
                </div>
                {note && <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{note}</p>}
            </div>
            <div className="grid gap-4">{children}</div>
        </section>
    );
}

function SettingRow({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
    return (
        <div className={fieldRowClass}>
            <div>
                <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                {note && <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{note}</p>}
            </div>
            <div>{children}</div>
        </div>
    );
}

export function Settings({ onLock }: SettingsProps) {
    const [coachingStyle, setCoachingStyle] = useState('compassionate');
    const [analysisDepth, setAnalysisDepth] = useState('brief');
    const [modelName, setModelName] = useState('gemma:2b');
    const [emotionModel, setEmotionModel] = useState('default');
    const [userName, setUserName] = useState('');
    const [crisisRegion, setCrisisRegion] = useState('global');
    const [storageLocation, setStorageLocation] = useState('');
    const [auditEvents, setAuditEvents] = useState<main.AnalysisAuditEvent[]>([]);
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

    useEffect(() => {
        (async () => {
            try {
                const s = await GetSettings();
                setCoachingStyle(s.coaching_style || 'compassionate');
                setAnalysisDepth(s.analysis_depth || 'brief');
                setModelName(canonicalModelName(s.model_name || 'gemma:2b'));
                setEmotionModel(canonicalModelName(s.emotion_model || 'default'));
                setUserName(s.user_name || '');
                setCrisisRegion(s.crisis_region || 'global');
                setStorageLocation(await GetSanctumDirectory());
                setAuditEvents((await GetAnalysisAudit(8)) || []);
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
        await SaveSettings(coachingStyle, analysisDepth, modelName, emotionModel, userName, crisisRegion, true);
        setSaved(true);
        setAuditEvents((await GetAnalysisAudit(8)) || []);
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
                <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
                    The base model will handle emotion analysis.
                </p>
            );
        }

        const isInstalled = modelIsInstalled(installedModels, targetModel);
        const isInstalling = installingModel === targetModel;

        return (
            <div className="mt-2 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.42)] px-3 py-2.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
                        <p className="mt-1 text-sm leading-5 text-[var(--muted-strong)]">
                            {ollamaRunning === false
                                ? "Ollama is not running."
                                : isInstalled
                                    ? "Installed in Ollama."
                                    : `Install ${targetModel} from Ollama.`}
                        </p>
                    </div>

                    {isInstalled ? (
                        <span className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-2.5 text-xs font-semibold text-[var(--accent-strong)]">
                            <Check size={13} />
                            Installed
                        </span>
                    ) : ollamaRunning === false ? (
                        <button type="button" onClick={refreshModelStatus} disabled={checkingModels} className="action-secondary h-8 px-3 py-0 text-xs">
                            Check models
                        </button>
                    ) : isInstalling ? (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                            <button type="button" disabled className="action-primary h-8 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-80">
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#f8f7f2] border-t-transparent" />
                                Installing...
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCancelInstall(targetModel)}
                                disabled={cancelingModel === targetModel}
                                className="action-secondary h-8 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                {cancelingModel === targetModel ? "Canceling..." : "Cancel"}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleInstallModel(targetModel)}
                            disabled={isInstalling || Boolean(installingModel) || checkingModels}
                            className="action-primary h-8 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-55"
                        >
                            <Download size={13} />
                            Install
                        </button>
                    )}
                </div>

                {isInstalling && (
                    <div className="mt-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-[var(--muted-strong)]">
                                {installStatus || "Downloading model files..."}
                            </p>
                            {installProgress !== null && (
                                <p className="text-xs font-semibold text-[var(--muted)]">{installProgress}%</p>
                            )}
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(93,117,99,0.14)]">
                            <div
                                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                                style={{ width: `${installProgress ?? 18}%` }}
                            />
                        </div>
                    </div>
                )}

                {installFeedbackModel === targetModel && installError && (
                    <div className="mt-3 rounded-[22px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.42)] p-3 text-sm leading-6 text-[#8a5f42]">
                        <p>{installError}</p>
                        <button type="button" onClick={refreshModelStatus} className="action-secondary mt-3 h-8 px-3 py-0 text-xs">
                            Check models
                        </button>
                    </div>
                )}

                {installFeedbackModel === targetModel && installStatus && !installingModel && !installError && (
                    <div className="mt-3 rounded-[22px] border border-[var(--line)] bg-white p-3 text-sm leading-6 text-[var(--accent-strong)]">
                        {installStatus}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="page-shell">
                <div className="app-panel-strong flex min-h-[220px] items-center justify-center rounded-[32px]">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                </div>
            </div>
        );
    }

    const selectedPrimaryModel = availableModels.find((model) => model.id === modelName);
    const selectedEmotionModel = emoModels.find((model) => model.id === emotionModel);
    const ollamaStatus = checkingModels
        ? "Checking..."
        : ollamaRunning === false
            ? "Not running"
            : "Ready";

    return (
        <div className="page-shell enter-soft">
            <section className="app-panel-strong overflow-hidden rounded-[32px]">
                <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="icon-badge h-10 w-10 rounded-[1rem] shadow-none">
                            <SettingsIcon size={18} />
                        </span>
                        <div>
                            <p className="eyebrow">Preferences</p>
                            <h2 className="text-2xl font-semibold text-[var(--text)]">Settings</h2>
                        </div>
                    </div>

                    <button onClick={handleSave} className={`${saved ? "action-secondary" : "action-primary"} px-4 py-2 text-sm`}>
                        {saved ? "Settings saved" : "Save settings"}
                    </button>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <main className="min-w-0">
                        <SettingsSection
                            icon={<Brain size={16} className="text-[var(--accent-strong)]" />}
                            title="Profile & Reflection"
                            note="Keep the journal response personal without making the writing flow heavier."
                        >
                            <SettingRow label="Display name" note="Shown in greetings and coaching copy.">
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="Enter your name"
                                    className={selectClass}
                                />
                            </SettingRow>

                            <SettingRow label="Coaching style" note="Controls the tone of the AI reflection.">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {coachingStyles.map((style) => (
                                        <button key={style.id} onClick={() => setCoachingStyle(style.id)} className={compactOptionClass(coachingStyle === style.id)}>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--text)]">{style.label}</p>
                                                <p className="text-[11px] leading-4 text-[var(--muted)]">{style.description}</p>
                                            </div>
                                            {coachingStyle === style.id && <Check size={15} className="shrink-0 text-[var(--accent-strong)]" />}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>

                            <SettingRow label="Analysis depth" note="Sets how much detail appears in each response.">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {analysisDepths.map((depth) => (
                                        <button key={depth.id} onClick={() => setAnalysisDepth(depth.id)} className={compactOptionClass(analysisDepth === depth.id)}>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--text)]">{depth.label}</p>
                                                <p className="text-[11px] leading-4 text-[var(--muted)]">{depth.description}</p>
                                            </div>
                                            {analysisDepth === depth.id && <Check size={15} className="shrink-0 text-[var(--accent-strong)]" />}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>
                        </SettingsSection>

                        <SettingsSection
                            icon={<AlertTriangle size={16} className="text-[var(--accent-strong)]" />}
                            title="Safety"
                            note="Crisis checks stay on this device. The region only changes which support contacts are shown."
                        >
                            <SettingRow label="Resource region" note="Used when Sanctum pauses analysis and shows support options.">
                                <div className="grid gap-2 md:grid-cols-3">
                                    {crisisRegions.map((region) => (
                                        <button key={region.id} onClick={() => setCrisisRegion(region.id)} className={compactOptionClass(crisisRegion === region.id)}>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--text)]">{region.label}</p>
                                                <p className="text-[11px] leading-4 text-[var(--muted)]">{region.description}</p>
                                            </div>
                                            {crisisRegion === region.id && <Check size={15} className="shrink-0 text-[var(--accent-strong)]" />}
                                        </button>
                                    ))}
                                </div>
                            </SettingRow>
                        </SettingsSection>

                        <SettingsSection
                            icon={<Cpu size={16} className="text-[var(--accent-strong)]" />}
                            title="Local AI"
                            note="Choose the Ollama models used for reflections and optional emotion analysis."
                        >
                            <SettingRow label="Ollama status" note="Sanctum only checks the local service.">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span className={`inline-flex h-9 w-fit items-center rounded-full border px-3 text-xs font-semibold ${ollamaRunning === false
                                        ? "border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.35)] text-[#8a5f42]"
                                        : checkingModels
                                            ? "border-[var(--line)] bg-white text-[var(--muted-strong)]"
                                            : "border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.95)] text-[var(--accent-strong)]"
                                        }`}>
                                        {ollamaStatus}
                                    </span>
                                    <button type="button" onClick={refreshModelStatus} disabled={checkingModels} className="action-secondary h-9 px-3 py-0 text-xs disabled:cursor-not-allowed disabled:opacity-55">
                                        Check models
                                    </button>
                                </div>
                            </SettingRow>

                            <SettingRow label="Primary model" note={selectedPrimaryModel?.description || "Selected local reflection model."}>
                                <select value={modelName} onChange={(e) => setModelName(e.target.value)} className={selectClass}>
                                    {availableModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.label}
                                        </option>
                                    ))}
                                </select>
                                <div>
                                    {checkingModels ? (
                                        <div className="mt-2 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.42)] px-3 py-2.5">
                                            <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted-strong)]">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                                Checking installed models...
                                            </div>
                                        </div>
                                    ) : (
                                        renderModelInstallPanel(modelName, "Selected primary model")
                                    )}
                                </div>
                            </SettingRow>

                            <SettingRow label="Emotion model" note={selectedEmotionModel?.description || "Optional separate emotion model."}>
                                <select value={emotionModel} onChange={(e) => setEmotionModel(e.target.value)} className={selectClass}>
                                    {emoModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.label}
                                        </option>
                                    ))}
                                </select>
                                {emotionModel !== "default" && renderModelInstallPanel(emotionModel, "Selected emotion model")}
                            </SettingRow>
                        </SettingsSection>
                    </main>

                    <aside className="min-w-0 border-t border-[var(--line)] bg-[rgba(255,255,255,0.24)] lg:border-l lg:border-t-0">
                        <section className="px-5 py-5 sm:px-6">
                            <div className="flex items-center gap-2">
                                <KeyRound size={16} className="text-[var(--accent-strong)]" />
                                <h3 className="text-base font-semibold text-[var(--text)]">Vault Access</h3>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Change the vault password or lock the journal.</p>

                            <div className="mt-3 grid gap-3">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Current password"
                                    className={selectClass}
                                    autoComplete="current-password"
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password"
                                    className={selectClass}
                                    autoComplete="new-password"
                                />
                                <input
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className={selectClass}
                                    autoComplete="new-password"
                                />
                            </div>

                            {passwordFeedback && (
                                <div className="mt-3 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.52)] p-3 text-sm leading-6 text-[var(--muted-strong)]">
                                    {passwordFeedback}
                                </div>
                            )}

                            <div className="mt-4 grid gap-2">
                                <button
                                    type="button"
                                    onClick={handleChangePassword}
                                    disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                    className="action-primary h-11 w-full justify-center whitespace-nowrap px-4 py-0 text-sm disabled:cursor-not-allowed disabled:opacity-55"
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
                                    className="action-secondary h-11 w-full justify-center whitespace-nowrap px-4 py-0 text-sm disabled:cursor-not-allowed disabled:opacity-55"
                                >
                                    {lockingVault ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                    ) : (
                                        <Lock size={16} />
                                    )}
                                    {lockingVault ? "Locking..." : "Lock now"}
                                </button>
                            </div>
                        </section>

                        <section className="border-t border-[var(--line)] px-5 py-5 sm:px-6">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-[var(--accent-strong)]" />
                                <h3 className="text-base font-semibold text-[var(--text)]">Privacy</h3>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Journal text stays encrypted locally; the ledger stores metadata only.</p>

                            <dl className="mt-3 divide-y divide-[var(--line)] rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.36)]">
                                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Encryption</dt>
                                    <dd className="text-sm font-semibold text-[var(--text)]">AES-256-GCM</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Telemetry</dt>
                                    <dd className="text-sm font-semibold text-[var(--text)]">None</dd>
                                </div>
                                <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Storage</dt>
                                    <dd className="min-w-0 break-all text-right font-mono text-xs font-semibold leading-5 text-[var(--text)]" title={storageLocation || "Storage location unavailable"}>
                                        {storageLocation || "Storage location unavailable"}
                                    </dd>
                                </div>
                            </dl>

                            <div className="mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-[var(--text)]">Privacy ledger</h4>
                                    <span className="text-xs text-[var(--muted)]">{auditEvents.length} recent</span>
                                </div>

                                {auditEvents.length === 0 ? (
                                    <div className="mt-2 rounded-[22px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.28)] p-3">
                                        <p className="text-sm leading-6 text-[var(--muted-strong)]">
                                            No AI analysis events have been recorded yet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-2 max-h-[20rem] overflow-y-auto rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.34)]">
                                        {auditEvents.map((event) => (
                                            <div key={event.id} className="border-b border-[var(--line)] px-3 py-2.5 last:border-b-0">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-[var(--text)]">
                                                        {event.crisis_detected ? "Crisis safety check" : "AI analysis"}
                                                    </p>
                                                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-3 tracking-wide ${event.data_left_device ? "bg-[rgba(245,225,221,0.68)] text-[#8a5f42]" : "bg-[rgba(238,244,238,0.82)] text-[var(--accent-strong)]"}`}>
                                                        {event.data_left_device ? "Data left device" : "Stayed local"}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
                                                    {new Date(event.created_at).toLocaleString()} / {event.entry_id > 0 ? `Entry #${event.entry_id}` : "Unsaved entry"}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                                                    Mode: {event.mode} / Model: {event.model_name}
                                                    {event.emotion_model ? ` / Emotion: ${event.emotion_model}` : ""}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </aside>
                </div>
            </section>
        </div>
    );
}
