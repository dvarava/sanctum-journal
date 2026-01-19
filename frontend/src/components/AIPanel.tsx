import { Brain, Sparkles, AlertCircle } from 'lucide-react';

interface AIPanelProps {
    analysis: string;
    loading: boolean;
    status: string;
}

export function AIPanel({ analysis, loading, status }: AIPanelProps) {
    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex items-center gap-2 text-accent">
                <Brain size={20} />
                <h2 className="text-lg font-semibold tracking-wide uppercase text-xs">AI Coach</h2>
            </div>

            <div className={`transition-all duration-500 transform ${loading ? 'scale-[0.98] opacity-80' : 'scale-100 opacity-100'}`}>
                {!analysis && !loading && (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center text-gray-400">
                        <Sparkles className="mx-auto mb-3 opacity-50" size={32} />
                        <p className="text-sm">Write a journal entry and click "Analyze" to unlock insights.</p>
                    </div>
                )}

                {loading && (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <div className="animate-spin mb-3 mx-auto w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
                        <p className="text-sm text-accent animate-pulse">{status || "Analyzing..."}</p>
                    </div>
                )}

                {analysis && !loading && (
                    <div className="flex flex-col gap-4">
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 shadow-xl backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                    <Sparkles size={16} />
                                </div>
                                <h3 className="font-semibold text-white">Insight</h3>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-200">
                                {analysis}
                            </p>
                        </div>

                        {/* Placeholder for future detailed stats */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">Emotional Clarity</span>
                                <span className="text-xs text-accent">High</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-accent w-[75%]" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-auto p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex gap-3">
                <AlertCircle size={16} className="shrink-0" />
                <p>Your entries are encrypted and analyzed locally. No data leaves this device.</p>
            </div>
        </div>
    );
}
