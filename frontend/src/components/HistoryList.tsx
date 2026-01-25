import { FileText, Calendar } from 'lucide-react';
import { main } from "../../wailsjs/go/models";

interface HistoryListProps {
    entries: main.Entry[];
    onSelectEntry: (entry: main.Entry) => void;
}

export function HistoryList({ entries, onSelectEntry }: HistoryListProps) {
    return (
        <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
            <h2 className="text-2xl font-serif text-white/90 mb-6">Journal History</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-500">
                        <p>No entries found. Start writing today.</p>
                    </div>
                )}

                {entries.map((entry, idx) => (
                    <div
                        key={entry.id}
                        onClick={() => onSelectEntry(entry)}
                        className="group relative p-6 bg-surface/40 hover:bg-surface/60 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-white/90 truncate pr-2" title={entry.title}>
                                    {entry.title || "Untitled Entry"}
                                </span>
                                <div className="flex items-center gap-2 text-accent/80 shrink-0">
                                    <Calendar size={12} />
                                    <span className="text-xs font-mono opacity-70">
                                        {new Date(entry.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed font-light">
                                {entry.preview}
                            </p>

                            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 group-hover:text-accent transition-colors">
                                <FileText size={12} />
                                <span className="uppercase tracking-wider">Read Full Entry</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
