import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, Cpu, Download, ShieldCheck } from "lucide-react";
import { DetectHardware, GetSettings, IsOllamaRunning, ListModels, PullModel, SaveSettings } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

interface OnboardingProps {
    onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState(1);
    const [hwInfo, setHwInfo] = useState<main.HardwareInfo | null>(null);
    const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
    const [installedModels, setInstalledModels] = useState<string[]>([]);
    const [isPulling, setIsPulling] = useState(false);
    const [pullError, setPullError] = useState("");

    useEffect(() => {
        const checkSystem = async () => {
            try {
                const hw = await DetectHardware();
                setHwInfo(hw);

                const isRunning = await IsOllamaRunning();
                setOllamaRunning(isRunning);

                if (isRunning) {
                    const models = await ListModels();
                    setInstalledModels(models || []);
                }
            } catch (e) {
                console.error("Setup check failed", e);
            }
        };

        checkSystem();
    }, []);

    const handleInstallModel = async () => {
        if (!hwInfo?.recommended_model) return;
        setIsPulling(true);
        setPullError("");

        try {
            await PullModel(hwInfo.recommended_model);

            const models = await ListModels();
            if (models && models.includes(`${hwInfo.recommended_model}:latest`)) {
                setInstalledModels(models);
                setStep(3);
            } else {
                setPullError("Installation finished but the model was not found afterward. Please try again or install it manually.");
            }
        } catch (e: any) {
            setPullError(e.message || "Failed to download model.");
        } finally {
            setIsPulling(false);
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
        const hasRecommended = installedModels.some((model) => model.startsWith(hwInfo?.recommended_model || ""));

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

                        {!ollamaRunning ? (
                            <div className="rounded-[28px] border border-[rgba(177,95,78,0.22)] bg-[rgba(245,225,221,0.86)] p-5 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <AlertTriangle className="mt-1 shrink-0 text-[#9a5d4d]" size={22} />
                                    <div>
                                        <h3 className="text-lg font-semibold text-[#7b4e42]">Ollama is not running</h3>
                                        <a
                                            href="https://ollama.com/download"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="action-secondary mt-5 inline-flex"
                                        >
                                            Download Ollama
                                        </a>
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
                                        {pullError}
                                    </div>
                                )}
                                <button
                                    onClick={handleInstallModel}
                                    disabled={isPulling}
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
