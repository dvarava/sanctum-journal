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
                <nav className="w-full shrink-0 border-b border-[var(--line)] bg-[rgba(250,248,242,0.58)] backdrop-blur-xl lg:min-h-screen lg:w-[240px] lg:border-b-0 lg:border-r">
                    <div className="flex flex-col gap-5 px-4 py-4 sm:px-5 lg:h-full lg:px-6 lg:py-7">
                        <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-start">
                            <div className="flex items-start gap-4">
                                <div className="icon-badge h-14 w-14 rounded-[1.4rem]">
                                    <svg
                                        width="28"
                                        height="28"
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
                                <div>
                                    <h1 className="mt-1 text-xl font-semibold text-[var(--text)]">Sanctum Journal</h1>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                            {navItems.map((item) => {
                                const isActive = activeView === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onNavigate(item.id)}
                                        className={`group flex min-w-[170px] items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all duration-200 lg:min-w-0 ${
                                            isActive
                                                ? "bg-[rgba(93,117,99,0.16)] text-[var(--accent-strong)] shadow-[0_16px_30px_rgba(65,82,71,0.12)] ring-1 ring-[rgba(93,117,99,0.18)]"
                                                : "bg-[rgba(255,255,255,0.4)] text-[var(--muted-strong)] hover:bg-[rgba(255,255,255,0.74)] hover:text-[var(--text)]"
                                        }`}
                                    >
                                        <span
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                                                isActive
                                                    ? "bg-[rgba(255,255,255,0.76)]"
                                                    : "bg-[rgba(255,255,255,0.52)] group-hover:bg-[rgba(255,255,255,0.86)]"
                                            }`}
                                        >
                                            <item.icon size={18} strokeWidth={isActive ? 2.3 : 2} />
                                        </span>
                                        <span className="min-w-0 text-sm font-semibold">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.62)] px-3 py-2 text-xs font-medium text-[var(--muted-strong)] lg:mt-auto lg:inline-flex lg:self-start">
                            <ShieldCheck size={14} className="text-[var(--accent-strong)]" />
                            Local-first
                        </div>
                    </div>
                </nav>

                <main className="flex min-h-0 flex-1 flex-col xl:flex-row">
                    <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

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
