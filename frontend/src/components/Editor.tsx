import { Save, Lock, Cloud, Cpu, Sparkles, Trash, Plus } from 'lucide-react';

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

export function Editor({ title, setTitle, value, onChange, onSave, onDelete, onNew, currentEntryId, isSaving, onAnalyze, useCloud, setUseCloud }: EditorProps) {
    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto w-full pt-12 pb-6 px-8 animate-in fade-in duration-700 delay-150 relative">

            {/* New Entry Button (Top Right) */}
            {(currentEntryId > 0 || value.length > 0) && (
                <button
                    onClick={onNew}
                    className="absolute top-8 right-0 text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-xs uppercase tracking-wider"
                    title="Start fresh entry"
                >
                    <Plus size={14} />
                    New Entry
                </button>
            )}

            {/* Header */}
            <header className="mb-4 text-center">
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">{dateStr}</span>
                {/* Title Input */}
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your entry a title..."
                    className="w-full text-center bg-transparent border-none outline-none text-3xl font-serif text-white/90 placeholder:text-white/20 mt-2 focus:ring-0 p-0"
                />
            </header>

            {/* Text Area */}
            <div className="flex-1 relative group">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Start writing to unlock your thoughts..."
                    className="w-full h-full bg-transparent resize-none border-none outline-none text-lg leading-relaxed text-gray-300 placeholder:text-gray-600 font-serif selection:bg-accent/30 p-4"
                    spellCheck={false}
                />

                {/* Floating Actions */}
                <div className="absolute bottom-4 right-4 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">

                    {/* Inspire Me Button */}
                    <button
                        onClick={() => {
                            const prompts = [
                                "What is a small win you had today?",
                                "What is one thing you are grateful for right now?",
                                "Describe a moment where you felt peaceful today.",
                                "What is worrying you, and what evidence do you have for it?",
                                "If you could talk to your younger self today, what would you say?"
                            ];
                            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
                            onChange(value ? value + "\n\n" + randomPrompt : randomPrompt);
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-pink-200 px-4 py-2 rounded-full border border-pink-500/20 backdrop-blur-sm transition-all shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                        title="Get a reflection prompt"
                    >
                        <Sparkles size={14} />
                        <span className="text-sm font-medium">Inspire Me</span>
                    </button>

                    {/* Model Toggle */}
                    <div className="flex bg-surface/50 rounded-full border border-white/5 p-1 backdrop-blur-sm">
                        <button
                            onClick={() => setUseCloud(false)}
                            className={`p-2 rounded-full transition-all ${!useCloud ? 'bg-accent/20 text-accent shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            title="Local AI (Privacy Focused)"
                        >
                            <Cpu size={14} />
                        </button>
                        <button
                            onClick={() => setUseCloud(true)}
                            className={`p-2 rounded-full transition-all ${useCloud ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            title="Cloud AI (Enhanced Capability)"
                        >
                            <Cloud size={14} />
                        </button>
                    </div>

                    {/* Delete Button (Only for existing entries) */}
                    {currentEntryId > 0 && (
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-full border border-red-500/20 backdrop-blur-sm transition-all"
                            title="Delete this entry"
                        >
                            <Trash size={16} />
                        </button>
                    )}

                    <button
                        onClick={onSave}
                        disabled={!value || isSaving}
                        className="flex items-center gap-2 bg-surface hover:bg-white/10 text-gray-300 px-4 py-2 rounded-full border border-white/5 shadow-lg backdrop-blur-sm transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Lock size={16} />
                        )}
                        <span className="text-sm font-medium">{isSaving ? 'Encrypting...' : 'Save'}</span>
                    </button>

                    <button
                        onClick={onAnalyze}
                        disabled={!value}
                        className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent px-5 py-2 rounded-full border border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm transition-all disabled:opacity-50"
                    >
                        <Save size={16} className="hidden" />
                        <span className="text-sm font-medium">Analyze</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
