import { Cloud, Cpu, Lock, Plus, Sparkles, Trash } from "lucide-react";

interface EditorProps {
    title: string;
    setTitle: (val: string) => void;
    value: string;
    onChange: (val: string) => void;
    onSave: () => void;
    onDelete: () => void;
    onNew: () => void;
    currentEntryId: number;
    isSaving: boolean;
    onAnalyze: () => void;
    useCloud: boolean;
    setUseCloud: (val: boolean) => void;
}

const prompts = [
    "What is feeling heavier than usual today?",
    "What is a small win you almost overlooked?",
    "Describe a moment that made you feel more grounded.",
    "What thought keeps returning, and what might it be asking for?",
    "If you spoke to yourself with more patience, what would you say?",
];

export function Editor({
    title,
    setTitle,
    value,
    onChange,
    onSave,
    onDelete,
    onNew,
    currentEntryId,
    isSaving,
    onAnalyze,
    useCloud,
    setUseCloud,
}: EditorProps) {
    const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const insertPrompt = () => {
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        onChange(value ? `${value}\n\n${randomPrompt}` : randomPrompt);
    };

    return (
        <div className="page-shell enter-soft">
            <section className="app-panel-strong flex min-h-[72vh] flex-col rounded-[32px] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 px-2 pb-4 sm:px-3">
                    <div className="min-w-0 flex-1">
                        <p className="eyebrow">{dateStr}</p>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Untitled"
                            className="mt-3 w-full bg-transparent text-2xl font-semibold text-[var(--text)] outline-none placeholder:text-[rgba(79,95,81,0.34)] sm:text-3xl"
                        />
                    </div>

                    {(currentEntryId > 0 || value.length > 0) && (
                        <button onClick={onNew} className="action-ghost h-10 px-4 text-sm">
                            <Plus size={15} />
                            New
                        </button>
                    )}
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[30px] border border-[var(--line)] bg-[rgba(255,252,246,0.76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="What feels most present right now?"
                        className="h-full min-h-[480px] w-full bg-transparent px-5 py-5 pb-28 text-[1.02rem] leading-8 text-[var(--muted-strong)] outline-none placeholder:text-[rgba(93,101,89,0.48)] sm:px-7 sm:py-6 sm:pb-28"
                        spellCheck={true}
                    />

                    <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-[26px] border border-[rgba(79,96,82,0.12)] bg-[rgba(255,255,255,0.84)] p-2 shadow-[0_16px_28px_rgba(63,78,66,0.12)] backdrop-blur-xl sm:inset-x-4 sm:bottom-4 sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={insertPrompt}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.86)] px-3 text-sm font-medium text-[var(--muted-strong)] transition-all hover:bg-white"
                            >
                                <Sparkles size={14} />
                                Prompt
                            </button>

                            <div className="flex items-center rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-1">
                                <button
                                    onClick={() => setUseCloud(false)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                                        !useCloud
                                            ? "bg-[rgba(93,117,99,0.14)] text-[var(--accent-strong)]"
                                            : "text-[var(--muted)] hover:text-[var(--text)]"
                                    }`}
                                    title="Local AI"
                                >
                                    <Cpu size={14} />
                                </button>
                                <button
                                    onClick={() => setUseCloud(true)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                                        useCloud
                                            ? "bg-[rgba(118,136,154,0.14)] text-[#476071]"
                                            : "text-[var(--muted)] hover:text-[var(--text)]"
                                    }`}
                                    title="Cloud AI"
                                >
                                    <Cloud size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentEntryId > 0 && (
                                <button
                                    onClick={onDelete}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(184,143,99,0.22)] bg-[rgba(245,225,221,0.72)] text-[#8a5f42] transition-all hover:bg-[rgba(245,225,221,0.92)]"
                                    title="Delete entry"
                                >
                                    <Trash size={14} />
                                </button>
                            )}

                            <button
                                onClick={onAnalyze}
                                disabled={!value}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[rgba(93,117,99,0.16)] bg-[rgba(238,244,238,0.9)] px-3.5 text-sm font-medium text-[var(--accent-strong)] transition-all hover:bg-[rgba(238,244,238,1)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Sparkles size={14} />
                                Analyze
                            </button>

                            <button
                                onClick={onSave}
                                disabled={!value || isSaving}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#536b59,#415247)] px-3.5 text-sm font-medium !text-[#f8f7f2] shadow-[0_14px_26px_rgba(65,82,71,0.16)] transition-all hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none [&_svg]:!text-[#f8f7f2]"
                            >
                                {isSaving ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                                ) : (
                                    <Lock size={14} />
                                )}
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
