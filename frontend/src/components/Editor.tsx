import { Save, Lock, Cloud, Cpu } from 'lucide-react';

interface EditorProps {
    value: string;
    onChange: (val: string) => void;
    onSave: () => void;
    isSaving: boolean;
    onAnalyze: () => void;
    useCloud: boolean;
    setUseCloud: (val: boolean) => void;
}

export function Editor({ value, onChange, onSave, isSaving, onAnalyze, useCloud, setUseCloud }: EditorProps) {
    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto w-full pt-12 pb-6 px-8 animate-in fade-in duration-700 delay-150">

            {/* Header */}
            <header className="mb-8 text-center">
                <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">{dateStr}</span>
                <h1 className="text-3xl font-serif text-white/90 mt-2">What's on your mind today?</h1>
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
