import { ReactNode } from 'react';
import { Home, PenTool, History as HistoryIcon, Settings } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    rightPanel?: ReactNode;
}

export function Layout({ children, activeView, onNavigate, rightPanel }: LayoutProps) {
    const navItems = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'write', icon: PenTool, label: 'Write' },
        { id: 'history', icon: HistoryIcon, label: 'History' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#0f172a] text-gray-100 font-sans selection:bg-accent selection:text-gray-900 relative">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute top-[40%] right-[-10%] w-[40%] h-[60%] bg-accent/20 rounded-full blur-[100px] animate-pulse delay-700" />
                <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Sidebar */}
            <nav className="relative z-20 w-20 flex flex-col items-center py-8 border-r border-white/10 bg-slate-900/30 backdrop-blur-xl shadow-[5px_0_30px_0_rgba(0,0,0,0.3)]">
                <div className="mb-8 text-accent drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M8 11h8" />
                        <path d="M12 15V7" />
                    </svg>
                </div>

                <div className="flex flex-col gap-6 w-full px-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 group relative
                ${activeView === item.id
                                    ? 'bg-white/10 text-primary shadow-[0_0_15px_0_rgba(56,189,248,0.3)] border border-white/10'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 hover:border hover:border-white/5'}`}
                        >
                            <item.icon size={24} strokeWidth={activeView === item.id ? 2.5 : 2} />
                            <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800/90 border border-white/10 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-md">
                                {item.label}
                            </div>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
                    {children}
                </div>

                {/* Right Panel */}
                {rightPanel && (
                    <aside className="w-[380px] border-l border-white/10 bg-slate-900/30 backdrop-blur-xl p-6 overflow-y-auto shadow-[-5px_0_30px_0_rgba(0,0,0,0.3)]">
                        {rightPanel}
                    </aside>
                )}
            </main>
        </div>
    );
}
