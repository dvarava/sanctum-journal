import { useState, useEffect } from "react";
import { DetectHardware, IsOllamaRunning, ListModels, PullModel, GetSettings, SaveSettings } from "../../wailsjs/go/main/App";
import { Cpu, ShieldCheck, Download, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
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

            // Validate it installed by listing again
            const models = await ListModels();
            if (models && models.includes(hwInfo.recommended_model + ":latest")) {
                setInstalledModels(models);
                setStep(3); // success
            } else {
                setPullError("Installation finished but model not found in list. Please try again or install manually.");
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
                currentSettings.emotion_model || 'default',
                currentSettings.user_name,
                true // flag complete
            );
        } catch (e) {
            console.error("Failed saving settings", e);
        }
        onComplete();
    };

    // Wizard Step 1: Welcome & Value Prop
    if (step === 1) {
        return (
            <div className="flex flex-col items-center justify-center p-12 max-w-2xl mx-auto h-full text-center animate-in fade-in zoom-in-95 duration-700">
                <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(45,212,191,0.2)]">
                    <ShieldCheck size={32} className="text-accent" />
                </div>
                <h1 className="text-4xl font-serif text-white/95 mb-4 leading-tight">Your Private Space. <br />Your Personal Coach.</h1>
                <p className="text-lg text-gray-400 font-light mb-12 max-w-lg leading-relaxed">
                    Sanctum uses advanced local AI to analyse your entries and provide cognitive reframes — completely offline. Your thoughts never leave your device.
                </p>
                <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 font-semibold rounded-full hover:bg-accent hover:text-white transition-all shadow-[0_0_20px_rgba(45,212,191,0.2)] group"
                >
                    Setup Intelligence
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        );
    }

    // Wizard Step 2: Hardware Check & Model Selection
    if (step === 2) {
        const hasRecommended = installedModels.some(m => m.startsWith(hwInfo?.recommended_model || ""));

        return (
            <div className="flex flex-col p-12 max-w-2xl mx-auto h-full animate-in slide-in-from-right-8 duration-500">
                <h2 className="text-2xl font-serif text-white/90 mb-2">Configuring AI for your Mac</h2>
                <p className="text-gray-400 mb-8 border-b border-white/5 pb-8">We've scanned your hardware to recommend the most optimal model.</p>

                {hwInfo && (
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8 flex items-start gap-4">
                        <Cpu className="text-accent mt-1" size={24} />
                        <div>
                            <h3 className="text-lg font-medium text-white/90 mb-1">System Profile</h3>
                            <p className="text-sm text-gray-400 mb-4">{hwInfo.os} • {hwInfo.total_ram_gb}GB Memory</p>

                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <span className="text-xs uppercase tracking-wider text-accent/80 font-bold mb-1 block">Recommended Model</span>
                                <span className="text-lg font-mono text-white/90">{hwInfo.recommended_model}</span>
                                <p className="text-xs text-gray-500 mt-2">
                                    {hwInfo.total_ram_gb < 8 ? "Optimised for low memory systems." : "The best balance of deep reasoning and speed for your hardware."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!ollamaRunning ? (
                    <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-start gap-4">
                        <AlertTriangle className="text-red-400 shrink-0" size={24} />
                        <div>
                            <h3 className="text-white/90 font-medium mb-1">Ollama is not running</h3>
                            <p className="text-sm text-red-200/70 mb-4">You must install and run the Ollama app before continuing.</p>
                            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-xs px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors">
                                Download Ollama
                            </a>
                        </div>
                    </div>
                ) : hasRecommended ? (
                    <div className="text-center mt-4">
                        <div className="inline-flex items-center gap-2 mb-6 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full text-sm font-medium">
                            <CheckCircle size={16} /> Model ready
                        </div>
                        <button
                            onClick={() => setStep(3)}
                            className="w-full py-4 bg-accent/20 text-accent font-semibold rounded-xl hover:bg-accent/30 transition-all border border-accent/30"
                        >
                            Continue
                        </button>
                    </div>
                ) : (
                    <div>
                        {pullError && (
                            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                                {pullError}
                            </div>
                        )}
                        <button
                            onClick={handleInstallModel}
                            disabled={isPulling}
                            className={`w-full py-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-3 border ${isPulling
                                ? "bg-white/5 border-white/10 text-gray-400 cursor-not-allowed"
                                : "bg-accent/20 text-accent border-accent/30 hover:bg-accent/30"
                                }`}
                        >
                            {isPulling ? (
                                <>
                                    <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full" />
                                    Downloading Model (this may take a while)...
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    Download & Install Model
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-gray-500 mt-4">Requires approx. {hwInfo?.total_ram_gb && hwInfo.total_ram_gb < 8 ? "1.5GB" : "3GB"} of disk space.</p>
                    </div>
                )}
            </div>
        );
    }

    // Wizard Step 3: Success
    return (
        <div className="flex flex-col items-center justify-center p-12 max-w-2xl mx-auto h-full text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <CheckCircle size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-3xl font-serif text-white/95 mb-4">Sanctum is Ready</h2>
            <p className="text-gray-400 mb-10 max-w-md">Your AI intelligence is configured and running completely locally securely.</p>
            <button
                onClick={finishOnboarding}
                className="px-10 py-4 bg-white text-slate-900 font-bold rounded-full hover:bg-emerald-400 transition-colors shadow-lg"
            >
                Start Journaling
            </button>
        </div>
    );
}
