import { useEffect, useState } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';

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
            <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-accent/20 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] shadow-accent/5">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center">
                            <Sparkles size={12} className="text-accent" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-accent/80">
                            Auto Insight
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onDismiss, 300);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X size={12} className="text-gray-500" />
                    </button>
                </div>

                {/* Emotion chips */}
                {emotions.length > 0 && (
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                        {emotions.map((e, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent/90 border border-accent/20"
                            >
                                {e}
                            </span>
                        ))}
                    </div>
                )}

                {/* Coaching preview */}
                <p className="text-sm text-white/80 leading-relaxed line-clamp-2 mb-3">
                    {coaching}
                </p>

                {/* Expand action */}
                <button
                    onClick={handleExpand}
                    className="flex items-center gap-1 text-xs text-accent/70 hover:text-accent transition-colors group"
                >
                    <span>View full insight</span>
                    <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </div>
    );
}
