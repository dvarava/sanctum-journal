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
        <div className="flex h-screen w-full overflow-hidden bg-background text-gray-100 font-sans selection:bg-accent selection:text-gray-900">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] opacity-30 animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] opacity-30 animate-pulse delay-1000" />
            </div>

            {/* Sidebar */}
            <nav className="relative z-10 w-20 flex flex-col items-center py-8 border-r border-white/5 bg-surface/30 backdrop-blur-md">
                <div className="mb-8 text-accent">
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
                            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group
                ${activeView === item.id
                                    ? 'bg-primary/10 text-primary shadow-lg shadow-primary/5'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <item.icon size={24} strokeWidth={activeView === item.id ? 2.5 : 2} />
                            <span className="text-[10px] mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity absolute left-16 bg-surface px-2 py-1 rounded border border-white/10 pointer-events-none z-50 whitespace-nowrap">
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    {children}
                </div>

                {/* Right Panel */}
                {rightPanel && (
                    <aside className="w-[350px] border-l border-white/5 bg-surface/20 backdrop-blur-md p-6 overflow-y-auto">
                        {rightPanel}
                    </aside>
                )}
            </main>
        </div>
    );
}
