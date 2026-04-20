import { ArrowRight, Calendar, FileText, PenLine } from "lucide-react";
import { main } from "../../wailsjs/go/models";

interface HistoryListProps {
    entries: main.Entry[];
    onSelectEntry: (entry: main.Entry) => void;
    onCreateEntry: () => void;
}

export function HistoryList({ entries, onSelectEntry, onCreateEntry }: HistoryListProps) {
    const currentDate = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);

    const entriesThisWeek = entries.filter((entry) => new Date(entry.created_at) >= weekAgo).length;
    const entriesThisMonth = entries.filter((entry) => {
        const entryDate = new Date(entry.created_at);
        return (
            entryDate.getMonth() === currentDate.getMonth() &&
            entryDate.getFullYear() === currentDate.getFullYear()
        );
    }).length;

    return (
        <div className="page-shell enter-soft flex min-h-screen flex-col !py-6 sm:!py-8">
            <section className="app-panel-strong flex min-h-0 flex-1 flex-col rounded-[32px] p-6 sm:p-8">
                <div className="flex min-h-0 flex-1 flex-col gap-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="eyebrow">Archive</p>
                            <h2 className="page-title mt-3">Your journal history</h2>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="metric-card">
                                <span className="metric-label">Entries</span>
                                <span className="metric-value">{entries.length}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-label">This Week</span>
                                <span className="metric-value">{entriesThisWeek}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-label">This Month</span>
                                <span className="metric-value">{entriesThisMonth}</span>
                            </div>
                        </div>
                    </div>

                    {entries.length === 0 ? (
                        <div className="flex min-h-[34rem] flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--line-strong)] bg-[rgba(255,255,255,0.5)] px-6 py-16 text-center sm:px-8">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[rgba(93,117,99,0.14)] bg-[rgba(238,244,238,0.84)] text-[var(--accent-strong)]">
                                <FileText size={22} />
                            </div>
                            <h3 className="mt-5 text-xl font-semibold text-[var(--text)]">No saved reflections yet</h3>
                            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">
                                Your archive will begin the moment you save your first entry. Each saved reflection appears here with its date, preview, and emotional tags.
                            </p>
                            <button type="button" onClick={onCreateEntry} className="action-primary mt-6 px-5 py-3">
                                <PenLine size={16} />
                                Start writing
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {entries.map((entry) => (
                                <button
                                    key={entry.id}
                                    onClick={() => onSelectEntry(entry)}
                                    className="group app-panel rounded-[28px] p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:bg-[rgba(255,255,255,0.86)]"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-semibold text-[var(--text)]" title={entry.title}>
                                                {entry.title || "Untitled entry"}
                                            </h3>
                                            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-3 py-1 text-xs text-[var(--muted)]">
                                                <Calendar size={12} />
                                                {new Date(entry.created_at).toLocaleDateString(undefined, {
                                                    weekday: "short",
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </div>
                                        </div>
                                        <span className="icon-badge h-10 w-10 rounded-[1rem]">
                                            <FileText size={16} />
                                        </span>
                                    </div>

                                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--muted)]">
                                        {entry.preview}
                                    </p>

                                    {entry.emotions && entry.emotions.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {entry.emotions.slice(0, 3).map((emotion, index) => (
                                                <span
                                                    key={index}
                                                    className="rounded-full border border-[rgba(93,117,99,0.14)] bg-[rgba(238,244,238,0.84)] px-3 py-1 text-xs text-[var(--accent-strong)]"
                                                >
                                                    {emotion}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
                                        Open entry
                                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
