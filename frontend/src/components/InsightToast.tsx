import { useEffect, useState } from "react";
import { ChevronRight, Sparkles, X } from "lucide-react";

interface InsightToastProps {
    emotions: string[];
    coaching: string;
    onExpand: () => void;
    onDismiss: () => void;
}

export function InsightToast({ emotions, coaching, onExpand, onDismiss }: InsightToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // animate in
        const show = setTimeout(() => setIsVisible(true), 50);

        // auto-dismiss after 12 seconds
        const hide = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300); // wait for exit animation
        }, 12000);

        return () => {
            clearTimeout(show);
            clearTimeout(hide);
        };
    }, [onDismiss]);

    const handleExpand = () => {
        setIsVisible(false);
        setTimeout(onExpand, 200);
    };

    return (
        <div
            className={`fixed bottom-6 right-6 z-40 max-w-sm transition-all duration-300 ${isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
        >
            <div className="app-panel-strong rounded-[26px] p-4 shadow-[0_24px_40px_rgba(63,78,66,0.16)]">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="icon-badge h-8 w-8 rounded-[0.9rem]">
                            <Sparkles size={14} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                            Auto Insight
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onDismiss, 300);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.72)] hover:text-[var(--text)]"
                    >
                        <X size={13} />
                    </button>
                </div>

                {emotions.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {emotions.map((e, i) => (
                            <span
                                key={i}
                                className="rounded-full border border-[rgba(93,117,99,0.14)] bg-[rgba(238,244,238,0.82)] px-2.5 py-1 text-[10px] text-[var(--accent-strong)]"
                            >
                                {e}
                            </span>
                        ))}
                    </div>
                )}

                <p className="mb-3 text-sm leading-7 text-[var(--muted-strong)] line-clamp-2">
                    {coaching}
                </p>

                <button
                    onClick={handleExpand}
                    className="group flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--accent-strong)] transition-colors hover:text-[var(--text)]"
                >
                    <span>View full insight</span>
                    <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </div>
    );
}
