import { Brain, Sparkles, AlertCircle, Heart, MessageCircle } from 'lucide-react';

interface AnalysisResult {
    emotions: string[];
    coaching: string;
}

interface AIPanelProps {
    analysis: AnalysisResult | null;
    loading: boolean;
    status: string;
    useCloud: boolean;
}

export function AIPanel({ analysis, loading, status, useCloud }: AIPanelProps) {
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
                        {/* Emotions Card */}
                        <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-500/10 to-blue-600/5 border-t border-l border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                                <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center text-blue-300 shadow-[0_0_15px_rgba(96,165,250,0.3)]">
                                    <Heart size={16} />
                                </div>
                                <h3 className="font-semibold text-white tracking-wide">Analysis</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {analysis.emotions && analysis.emotions.length > 0 ? (
                                    analysis.emotions.map((emotion, i) => (
                                        <span key={i} className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/20 text-blue-200 text-sm">
                                            {emotion}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-400 text-sm">No specific emotions detected.</span>
                                )}
                            </div>
                        </div>

                        {/* Coaching Card */}
                        <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 border-t border-l border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                                    <MessageCircle size={16} />
                                </div>
                                <h3 className="font-semibold text-white tracking-wide">Coaching</h3>
                            </div>
                            <p className="text-sm leading-7 text-gray-200 font-light tracking-wide italic">
                                "{analysis.coaching}"
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className={`mt-auto p-4 rounded-xl border text-xs flex gap-3 transition-colors duration-500 ${useCloud ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-blue-500/10 border-blue-500/20 text-blue-200'}`}>
                <AlertCircle size={16} className="shrink-0" />
                <p>
                    {useCloud
                        ? "Cloud Mode Active. Analysis data is processed via OpenAI API."
                        : "Your entries are encrypted and analyzed locally. No data leaves this device."}
                </p>
            </div>
        </div>
    );
}
