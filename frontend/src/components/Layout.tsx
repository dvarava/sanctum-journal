import { ReactNode } from "react";
import { Home, PenTool, History as HistoryIcon, Settings, ShieldCheck } from "lucide-react";

interface LayoutProps {
    children: ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    rightPanel?: ReactNode;
}

export function Layout({ children, activeView, onNavigate, rightPanel }: LayoutProps) {
    const navItems = [
        { id: "home", icon: Home, label: "Home" },
        { id: "write", icon: PenTool, label: "Write" },
        { id: "history", icon: HistoryIcon, label: "History" },
        { id: "settings", icon: Settings, label: "Settings" },
    ];

    return (
        <div className="relative min-h-screen overflow-hidden text-[var(--text)]">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div
                    className="absolute left-[-8%] top-[-10%] h-[24rem] w-[24rem] rounded-full blur-3xl"
                    style={{
                        background: "radial-gradient(circle, rgba(232, 218, 198, 0.9) 0%, transparent 68%)",
                        animation: "ambient-drift 20s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute right-[-12%] top-[18%] h-[26rem] w-[26rem] rounded-full blur-3xl"
                    style={{
                        background: "radial-gradient(circle, rgba(217, 231, 219, 0.96) 0%, transparent 70%)",
                        animation: "ambient-drift 24s ease-in-out infinite",
                    }}
                />
                <div
                    className="absolute bottom-[-16%] left-[24%] h-[22rem] w-[22rem] rounded-full blur-3xl"
                    style={{
                        background: "radial-gradient(circle, rgba(255, 244, 230, 0.84) 0%, transparent 70%)",
                        animation: "ambient-drift 18s ease-in-out infinite",
                    }}
                />
            </div>

            <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
                <nav className="app-nav" aria-label="Primary navigation">
                    <div className="app-nav-inner">
                        <div className="app-nav-top">
                            <div className="app-brand">
                                <div className="icon-badge app-brand-mark">
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        <path d="M8 11h8" />
                                        <path d="M12 15V7" />
                                    </svg>
                                </div>
                                <div className="app-brand-copy">
                                    <h1>Sanctum Journal</h1>
                                    <span>Private reflection space</span>
                                </div>
                            </div>

                            {/* <div className="app-nav-privacy">
                                <ShieldCheck size={14} />
                                <span>Local-first</span>
                            </div> */}
                        </div>

                        <div className="app-nav-list">
                            {navItems.map((item) => {
                                const isActive = activeView === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onNavigate(item.id)}
                                        className={`app-nav-button${isActive ? " is-active" : ""}`}
                                        aria-current={isActive ? "page" : undefined}
                                        title={item.label}
                                    >
                                        <span className="app-nav-icon">
                                            <item.icon size={18} strokeWidth={isActive ? 2.3 : 2} />
                                        </span>
                                        <span className="app-nav-label">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
{/* 
                        <div className="app-nav-privacy app-nav-privacy-desktop">
                            <ShieldCheck size={14} />
                            Local-first
                        </div> */}
                    </div>
                </nav>

                <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
                    <div className="content-scroll min-h-0 flex-1">{children}</div>

                    {/* Right Panel */}
                    {rightPanel && (
                        <aside className="min-h-0 w-full border-t border-[var(--line)] bg-[rgba(250,248,242,0.5)] px-4 py-4 backdrop-blur-xl xl:w-[380px] xl:overflow-y-auto xl:border-l xl:border-t-0 xl:px-6 xl:py-8">
                            {rightPanel}
                        </aside>
                    )}
                </main>
            </div>
        </div>
    );
}
