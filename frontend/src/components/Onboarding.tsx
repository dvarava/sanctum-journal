import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, Cpu, Download, ShieldCheck } from "lucide-react";
import { CancelPullModel, DetectHardware, GetSettings, IsOllamaRunning, ListModels, PullModel, SaveSettings } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { BrowserOpenURL, EventsOn } from "../../wailsjs/runtime/runtime";

interface OnboardingProps {
    onComplete: () => void;
}

type PullProgressEvent = {
    model?: string;
    status?: string;
    total?: number;
    completed?: number;
    error?: string;
};

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

const normalizeModelName = (modelName: string) => modelName.trim().replace(/:latest$/, "");

const modelIsInstalled = (models: string[], modelName: string) => {
    if (!modelName) return false;
    const target = normalizeModelName(modelName);
    return models.some((model) => normalizeModelName(model) === target);
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};

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

export function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [hwInfo, setHwInfo] = useState<main.HardwareInfo | null>(null);
    const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
    const [installedModels, setInstalledModels] = useState<string[]>([]);
    const [isCheckingSystem, setIsCheckingSystem] = useState(true);
    const [isPulling, setIsPulling] = useState(false);
    const [isCancelingPull, setIsCancelingPull] = useState(false);
    const [pullStatus, setPullStatus] = useState("");
    const [pullProgress, setPullProgress] = useState<number | null>(null);
    const [pullStartedAt, setPullStartedAt] = useState<number | null>(null);
    const [pullElapsedSeconds, setPullElapsedSeconds] = useState(0);
    const [pullError, setPullError] = useState("");

    const checkSystem = useCallback(async () => {
        setIsCheckingSystem(true);
        try {
            const hw = await DetectHardware();
            setHwInfo(hw);

            const isRunning = await IsOllamaRunning();
            setOllamaRunning(isRunning);

            if (isRunning) {
                const models = await ListModels();
                setInstalledModels(models || []);
            } else {
                setInstalledModels([]);
            }
        } catch (e) {
            console.error("Setup check failed", e);
            setOllamaRunning(false);
            setInstalledModels([]);
        } finally {
            setIsCheckingSystem(false);
        }
    }, []);

    useEffect(() => {
        checkSystem();
    }, [checkSystem]);

    useEffect(() => {
        const unsubscribe = EventsOn("ollama:pull-progress", (event: PullProgressEvent) => {
            if (!event || event.model !== hwInfo?.recommended_model) return;

            if (event.error) {
                setPullStatus(event.error);
                return;
            }

            if (event.status) {
                setPullStatus(formatPullStatus(event.status));
            }

            if (event.total && event.total > 0 && typeof event.completed === "number") {
                setPullProgress(Math.min(100, Math.round((event.completed / event.total) * 100)));
            }
        });

        return unsubscribe;
    }, [hwInfo?.recommended_model]);

    useEffect(() => {
        if (!isPulling || !pullStartedAt) return;

        const updateElapsed = () => {
            setPullElapsedSeconds(Math.floor((Date.now() - pullStartedAt) / 1000));
        };

        updateElapsed();
        const timer = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(timer);
    }, [isPulling, pullStartedAt]);

    const waitForModelToAppear = async (modelName: string) => {
        let latestModels: string[] = [];

        for (let attempt = 0; attempt < 10; attempt += 1) {
            latestModels = (await ListModels()) || [];
            if (modelIsInstalled(latestModels, modelName)) return latestModels;
            if (attempt < 9) await sleep(1000);
        }

        return latestModels;
    };

    const handleInstallModel = async () => {
        const recommendedModel = hwInfo?.recommended_model;
        if (!recommendedModel) return;

        setIsPulling(true);
        setPullError("");
        setPullProgress(null);
        setPullStatus("Starting model download...");
        setPullStartedAt(Date.now());
        setPullElapsedSeconds(0);
        setIsCancelingPull(false);

        try {
            const isRunning = await IsOllamaRunning();
            setOllamaRunning(isRunning);
            if (!isRunning) {
                setPullError("Ollama is not running yet. Start Ollama, then check again.");
                return;
            }

            await PullModel(recommendedModel);

            setPullStatus("Checking installed models...");
            const models = await waitForModelToAppear(recommendedModel);
            if (modelIsInstalled(models, recommendedModel)) {
                setInstalledModels(models);
                setPullStatus("Model ready.");
                setStep(3);
            } else {
                setInstalledModels(models);
                setPullError(`Download finished, but ${recommendedModel} did not appear in Ollama's model list yet. Click "Check again" or run "ollama list" to verify it manually.`);
            }
        } catch (e) {
            const message = getErrorMessage(e);
            if (isCancelError(message)) {
                setPullStatus("Download canceled.");
                return;
            }
            setPullError(message || "Failed to download model.");
        } finally {
            setIsPulling(false);
            setIsCancelingPull(false);
            setPullStartedAt(null);
        }
    };

    const handleCancelInstall = async () => {
        const recommendedModel = hwInfo?.recommended_model;
        if (!recommendedModel || !isPulling || isCancelingPull) return;

        setIsCancelingPull(true);
        setPullStatus("Canceling download...");

        try {
            const canceled = await CancelPullModel(recommendedModel);
            if (!canceled) {
                setPullStatus("Cancel request sent.");
            }
        } catch (e) {
            setPullError(getErrorMessage(e) || "Could not cancel download.");
            setIsCancelingPull(false);
        }
    };

    const finishOnboarding = async () => {
        try {
            const currentSettings = await GetSettings();
            await SaveSettings(
                currentSettings.coaching_style,
                currentSettings.analysis_depth,
                hwInfo?.recommended_model || currentSettings.model_name,
                currentSettings.emotion_model || "default",
                currentSettings.user_name,
                true
            );
        } catch (e) {
            console.error("Failed saving settings", e);
        }
        onComplete();
    };

    if (step === 1) {
        return (
            <div className="page-shell enter-soft">
                <section className="app-panel-strong mx-auto flex max-w-4xl flex-col items-center rounded-[36px] px-6 py-12 text-center sm:px-10 sm:py-16">
                    <div className="icon-badge h-20 w-20 rounded-[1.8rem]">
                        <ShieldCheck size={34} />
                    </div>
                    <p className="eyebrow mt-6">Welcome to Sanctum</p>
                    <h1 className="page-title mt-4 max-w-3xl">Your private space, with a calmer way to reflect</h1>
                    <button onClick={() => setStep(2)} className="action-primary mt-10">
                        Setup intelligence
                        <ArrowRight size={18} />
                    </button>
                </section>
            </div>
        );
    }

    if (step === 2) {
        const hasRecommended = modelIsInstalled(installedModels, hwInfo?.recommended_model || "");

        return (
            <div className="page-shell enter-soft">
                <section className="app-panel-strong mx-auto max-w-4xl rounded-[36px] p-6 sm:p-8">
                    <div className="flex flex-col gap-8">
                        <div>
                            <p className="eyebrow">Setup</p>
                            <h2 className="page-title mt-3">Configuring local AI for your device</h2>
                        </div>

                        {hwInfo && (
                            <div className="app-panel rounded-[28px] p-5 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <span className="icon-badge h-12 w-12 rounded-[1rem]">
                                        <Cpu size={20} />
                                    </span>
                                    <div className="flex-1">
                                        <p className="eyebrow">System Profile</p>
                                        <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">
                                            {hwInfo.os} • {hwInfo.total_ram_gb}GB memory
                                        </h3>
                                        <div className="app-panel-muted mt-4 rounded-[24px] p-4">
                                            <p className="eyebrow">Recommended Model</p>
                                            <p className="mt-2 font-mono text-base font-semibold text-[var(--text)]">
                                                {hwInfo.recommended_model}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isCheckingSystem || ollamaRunning === null ? (
                            <div className="app-panel-muted rounded-[28px] p-5 sm:p-6">
                                <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted-strong)]">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                    Checking Ollama and installed models...
                                </div>
                            </div>
                        ) : !ollamaRunning ? (
                            <div className="rounded-[28px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.86)] p-5 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <AlertTriangle className="mt-1 shrink-0 text-[#9a5d4d]" size={22} />
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#7b4e42]">Ollama is not running</h3>
                                        <p className="mt-2 text-sm leading-7 text-[#8a5f42]">
                                            Install Ollama, start it, then check again.
                                        </p>
                                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                            <button type="button" onClick={() => BrowserOpenURL(OLLAMA_DOWNLOAD_URL)} className="action-secondary inline-flex">
                                                Download Ollama
                                            </button>
                                            <button type="button" onClick={checkSystem} disabled={isCheckingSystem} className="action-secondary inline-flex">
                                                Check again
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : hasRecommended ? (
                            <div className="flex flex-col gap-4">
                                <div className="pill-chip w-fit bg-[rgba(238,244,238,0.92)] text-[var(--accent-strong)]">
                                    <CheckCircle size={14} />
                                    Recommended model is ready
                                </div>
                                <button onClick={() => setStep(3)} className="action-primary w-full justify-center">
                                    Continue
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {pullError && (
                                    <div className="rounded-[24px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.86)] p-4 text-sm leading-7 text-[#8a5f42]">
                                        <p>{pullError}</p>
                                        <button type="button" onClick={checkSystem} className="action-secondary mt-3 inline-flex">
                                            Check again
                                        </button>
                                    </div>
                                )}
                                {isPulling && (
                                    <div className="app-panel-muted rounded-[24px] p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm font-semibold text-[var(--text)]">
                                                {pullStatus || "Downloading model files..."}
                                            </p>
                                            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                                                {formatElapsedTime(pullElapsedSeconds)}
                                            </p>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(93,117,99,0.14)]">
                                            <div
                                                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                                                style={{ width: `${pullProgress ?? 18}%` }}
                                            />
                                        </div>
                                        <p className="mt-3 text-xs leading-6 text-[var(--muted-strong)]">
                                            Large models can take several minutes. Keep Ollama open while Sanctum downloads it.
                                        </p>
                                    </div>
                                )}
                                <button
                                    onClick={handleInstallModel}
                                    disabled={isPulling || isCheckingSystem}
                                    className={isPulling ? "action-secondary w-full justify-center" : "action-primary w-full justify-center"}
                                >
                                    {isPulling ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                                            Downloading model...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            Download and install model
                                        </>
                                    )}
                                </button>
                                {isPulling && (
                                    <button
                                        type="button"
                                        onClick={handleCancelInstall}
                                        disabled={isCancelingPull}
                                        className="action-secondary w-full justify-center"
                                    >
                                        {isCancelingPull ? "Canceling..." : "Cancel download"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="page-shell enter-soft">
            <section className="app-panel-strong mx-auto flex max-w-3xl flex-col items-center rounded-[36px] px-6 py-14 text-center sm:px-10">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.92)] shadow-[0_24px_40px_rgba(65,82,71,0.12)]">
                    <CheckCircle size={38} className="text-[var(--accent-strong)]" />
                </div>
                <p className="eyebrow mt-6">Ready</p>
                <h2 className="page-title mt-4">Sanctum is set up</h2>
                <button onClick={finishOnboarding} className="action-primary mt-10">
                    Start journaling
                </button>
            </section>
        </div>
    );
}
