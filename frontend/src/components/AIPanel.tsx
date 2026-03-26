import { AlertCircle, Brain, Cloud, Heart, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

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
}

export function AIPanel({ analysis, loading, status, useCloud }: AIPanelProps) {
    return (
        <div className="enter-soft flex h-full flex-col gap-5">
            <section className="app-panel-strong rounded-[30px] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                    <span className="icon-badge">
                        <Brain size={18} />
                    </span>
                    <div>
                        <h2 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">AI Coach</h2>
                    </div>
                </div>

                <div className="mt-6">
                    {!analysis && !loading && (
                        <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.56)] p-5 text-center">
                            <Sparkles size={24} className="mx-auto text-[var(--warm-strong)]" />
                            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">No analysis yet.</p>
                        </div>
                    )}

                    {loading && (
                        <div className="rounded-[24px] border border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.82)] p-6 text-center">
                            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                            <p className="text-sm font-medium text-[var(--accent-strong)]">{status || "Analyzing..."}</p>
                        </div>
                    )}

                    {analysis && !loading && (
                        <div className="flex flex-col gap-4">
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

                            <div className="rounded-[24px] border border-[rgba(184,143,99,0.14)] bg-[rgba(250,247,241,0.9)] p-5">
                                <div className="flex items-center gap-3">
                                    <span className="icon-badge h-10 w-10 rounded-[1rem] bg-[linear-gradient(145deg,rgba(234,223,206,0.6),rgba(255,255,255,0.3))]">
                                        <MessageCircle size={16} />
                                    </span>
                                    <div>
                                        <p className="eyebrow">Reflection</p>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
                                    {analysis.coaching || "No coaching text was returned for this entry."}
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
                className={`rounded-[24px] border p-4 text-sm leading-6 transition-colors ${
                    useCloud
                        ? "border-[rgba(118,136,154,0.22)] bg-[rgba(233,240,245,0.84)] text-[#476071]"
                        : "border-[rgba(93,117,99,0.18)] bg-[rgba(238,244,238,0.84)] text-[var(--accent-strong)]"
                }`}
            >
                <div className="flex items-start gap-3">
                    <span className="mt-0.5">
                        {useCloud ? <Cloud size={16} /> : <ShieldCheck size={16} />}
                    </span>
                    <p>
                        {useCloud ? "Cloud mode." : "Local mode."}
                    </p>
                </div>
            </section>

            <div className="mt-auto rounded-[22px] border border-[rgba(184,143,99,0.16)] bg-[rgba(250,247,241,0.76)] p-4 text-xs leading-6 text-[var(--muted)]">
                <div className="flex items-start gap-3">
                    <AlertCircle size={15} className="mt-0.5 text-[var(--warm-strong)]" />
                    <p>Self-reflection only.</p>
                </div>
            </div>
        </div>
    );
}
