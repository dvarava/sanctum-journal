import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

interface AnalyzePromptToastProps {
    onAnalyze: () => void | Promise<void>;
    onDismiss: () => void;
}

export function AnalyzePromptToast({ onAnalyze, onDismiss }: AnalyzePromptToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const show = setTimeout(() => setIsVisible(true), 50);
        const hide = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onDismiss, 250);
        }, 10000);

        return () => {
            clearTimeout(show);
            clearTimeout(hide);
        };
    }, []);

    const dismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 250);
    };

    const analyze = () => {
        setIsVisible(false);
        setTimeout(() => {
            void onAnalyze();
        }, 180);
    };

    return (
        <div
            className={`fixed bottom-6 right-6 z-40 max-w-sm transition-all duration-300 ${
                isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
            }`}
        >
            <div className="app-panel-strong rounded-lg p-4 shadow-[0_24px_40px_rgba(63,78,66,0.16)]">
                <div className="flex items-start gap-3">
                    <span className="icon-badge h-9 w-9 rounded-lg">
                        <Sparkles size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--text)]">Entry saved</p>
                            <button
                                onClick={dismiss}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.72)] hover:text-[var(--text)]"
                                aria-label="Dismiss"
                            >
                                <X size={13} />
                            </button>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                            Ask the AI coach for a reflection when you are ready.
                        </p>
                        <button
                            onClick={analyze}
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#536b59,#415247)] px-3.5 text-sm font-medium !text-[#f8f7f2] shadow-[0_14px_26px_rgba(65,82,71,0.16)] transition-all hover:brightness-[1.03] [&_svg]:!text-[#f8f7f2]"
                        >
                            Analyze now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
