import { main } from "../../wailsjs/go/models";

interface HeatmapProps {
    entries: main.Entry[];
}

export function Heatmap({ entries }: HeatmapProps) {
    const days = Array.from({ length: 28 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (27 - i));
        return d;
    });

    const activeDates = new Set(entries.map(e => {
        return new Date(e.created_at).toISOString().split('T')[0];
    }));

    const calculateStreak = () => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (!activeDates.has(today) && !activeDates.has(yesterday)) {
            return 0;
        }

        let streak = 0;
        let checkDate = activeDates.has(today) ? new Date() : new Date(Date.now() - 86400000);

        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (activeDates.has(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    };

    const streak = calculateStreak();
    const activeCount = days.filter((date) => activeDates.has(date.toISOString().split("T")[0])).length;

    return (
        <div className="app-panel rounded-[28px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="eyebrow">Streak</p>
                    <h3 className="section-title mt-2 text-[1.65rem]">Consistency</h3>
                </div>
                <div className="pill-chip">
                    <span className="text-sm font-semibold text-[var(--accent-strong)]">
                        {streak} day{streak !== 1 ? "s" : ""}
                    </span>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2.5">
                {days.map((date, i) => {
                    const dateStr = date.toISOString().split("T")[0];
                    const isActive = activeDates.has(dateStr);

                    return (
                        <div
                            key={i}
                            title={date.toDateString()}
                            className={`aspect-square rounded-[0.95rem] border transition-all duration-200 ${
                                isActive
                                    ? "border-[rgba(93,117,99,0.16)] bg-[rgba(93,117,99,0.72)] shadow-[0_10px_22px_rgba(65,82,71,0.14)]"
                                    : "border-[rgba(79,96,82,0.1)] bg-[rgba(255,255,255,0.52)]"
                            } flex items-center justify-center`}
                        >
                            <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                    isActive ? "bg-white/90" : "bg-[rgba(93,117,99,0.16)]"
                                }`}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <p className="text-[var(--muted)]">
                    {activeCount} / 28 days
                </p>
                <div className="flex items-center gap-2 text-[var(--muted)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[rgba(93,117,99,0.72)]" />
                    Written
                </div>
            </div>
        </div>
    );
}
