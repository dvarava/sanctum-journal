import { Brain, Heart, Info, MessageCircle, Sparkles } from "lucide-react";

interface AnalysisResult {
    emotions: string[];
    coaching: string;
    similar_entries?: any[];
}

interface AIPanelProps {
    analysis: AnalysisResult | null;
    loading: boolean;
    status: string;
    useCloud: boolean;
    modelName: string;
    emotionModel: string;
}

export function AIPanel({ analysis, loading, status, useCloud, modelName, emotionModel }: AIPanelProps) {
    const hasSeparateEmotionModel = emotionModel && emotionModel !== "default";
    const isSystemMessage = analysis?.emotions?.some((emotion) =>
        ["error", "crisis detected"].includes(emotion.toLowerCase())
    );

    return (
        <div className="enter-soft flex h-full flex-col gap-5">
            <section className="app-panel-strong flex min-h-0 flex-1 flex-col rounded-[30px] p-5 sm:p-6">
                <div className="flex items-center gap-4">
                    <span className="icon-badge">
                        <Brain size={18} />
                    </span>
                    <div>
                        <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">AI Reflection</h2>
                    </div>
                </div>

                <div className="mt-6 flex min-h-0 flex-1 flex-col">
                    {!analysis && !loading && (
                        <div className="flex min-h-[15rem] flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--line-strong)] bg-[rgba(255,255,255,0.56)] px-5 py-8 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgba(184,143,99,0.16)] bg-[rgba(250,247,241,0.92)] text-[var(--warm-strong)]">
                                <Sparkles size={22} />
                            </div>
                            <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">Ready when you are</h3>
                            <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--muted-strong)]">
                                Write a journal entry, then press Analyze. Your emotions and reflection will appear here.
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-2">
                                <span className="rounded-full border border-[rgba(93,117,99,0.14)] bg-[rgba(238,244,238,0.84)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                                    Emotions
                                </span>
                                <span className="rounded-full border border-[rgba(184,143,99,0.14)] bg-[rgba(250,247,241,0.92)] px-3 py-1 text-xs font-semibold text-[#8a6a45]">
                                    Reflection
                                </span>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="rounded-[24px] border border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.82)] p-6 text-center">
                            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                            <p className="text-sm font-medium text-[var(--accent-strong)]">{status || "Analyzing..."}</p>
                        </div>
                    )}

                    {analysis && !loading && (
                        <div className="flex min-h-0 flex-1 flex-col gap-4">
                            <div className="rounded-[24px] border border-[rgba(93,117,99,0.16)] bg-[rgba(238,244,238,0.86)] p-5">
                                <div className="flex items-center gap-3">
                                    <span className="icon-badge h-10 w-10 rounded-[1rem]">
                                        <Heart size={16} />
                                    </span>
                                    <div>
                                        <p className="eyebrow">Emotions</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {analysis.emotions && analysis.emotions.length > 0 ? (
                                        analysis.emotions.map((emotion, i) => (
                                            <span
                                                key={i}
                                                className="rounded-full border border-[rgba(93,117,99,0.14)] bg-[rgba(255,255,255,0.72)] px-3 py-1.5 text-sm text-[var(--accent-strong)]"
                                            >
                                                {emotion}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm leading-7 text-[var(--muted)]">No distinct emotions were detected in this entry.</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-[14rem] flex-1 flex-col rounded-[24px] border border-[rgba(184,143,99,0.14)] bg-[rgba(250,247,241,0.9)] p-5">
                                <div className="flex items-center gap-3">
                                    <span className="icon-badge h-10 w-10 rounded-[1rem] bg-[linear-gradient(145deg,rgba(234,223,206,0.6),rgba(255,255,255,0.3))]">
                                        <MessageCircle size={16} />
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <p className="eyebrow">Reflection</p>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
                                    {analysis.coaching || "No coaching text was returned for this entry."}
                                </p>
                                <p className="mt-auto pt-5 text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--muted)]">
                                    {isSystemMessage ? "System notice" : "Generated by AI"}
                                </p>
                            </div>

                            {analysis.similar_entries && analysis.similar_entries.length > 0 && (
                                <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.56)] p-5">
                                    <p className="eyebrow">Related</p>
                                    <div className="mt-4 space-y-3">
                                        {analysis.similar_entries.map((entry, i) => (
                                            <div
                                                key={i}
                                                className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.74)] p-4"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="truncate text-sm font-semibold text-[var(--text)]">
                                                        {entry.title || "Untitled entry"}
                                                    </span>
                                                    <span className="text-xs text-[var(--muted)]">
                                                        {entry.created_at
                                                            ? new Date(entry.created_at).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })
                                                            : ""}
                                                    </span>
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-xs leading-6 text-[var(--muted)]">
                                                    {entry.preview}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <section
                className={`mt-auto rounded-[24px] border p-4 text-sm leading-6 transition-colors ${
                    useCloud
                        ? "border-[rgba(118,136,154,0.22)] bg-[rgba(233,240,245,0.84)] text-[#476071]"
                        : "border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.84)] text-[var(--accent-strong)]"
                }`}
            >
                <div className="flex items-start gap-3">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>
                        {useCloud
                            ? "Cloud Mode Active. Analysis data is processed via OpenAI API."
                            : "Your entries are encrypted and analyzed locally. No data leaves this device."}
                    </p>
                </div>
                {!useCloud && (
                    <p className="mt-3 text-xs leading-5 opacity-80">
                        Local model: {modelName || "Not selected"}
                        {hasSeparateEmotionModel ? ` / Emotion model: ${emotionModel}` : ""}
                    </p>
                )}
            </section>

            <p className="px-1 text-center text-[11px] leading-5 text-[var(--muted)]">
                Sanctum is for self-reflection. Not a substitute for professional medical advice.
            </p>
        </div>
    );
}
