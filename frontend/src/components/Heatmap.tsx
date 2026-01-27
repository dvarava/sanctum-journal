import { main } from "../../wailsjs/go/models";

interface HeatmapProps {
    entries: main.Entry[];
}

export function Heatmap({ entries }: HeatmapProps) {
    // generate last 28 days (4 weeks) for the grid
    const days = Array.from({ length: 28 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (27 - i));
        return d;
    });

    // map entries to date strings (YYYY-MM-DD)
    const activeDates = new Set(entries.map(e => {
        return new Date(e.created_at).toISOString().split('T')[0];
    }));

    // calculate current streak
    const calculateStreak = () => {
        const sortedDates = [...activeDates].sort().reverse();
        if (sortedDates.length === 0) return 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // if no entry today or yesterday, streak is lost (0)
        if (!activeDates.has(today) && !activeDates.has(yesterday)) {
            return 0;
        }

        let streak = 0;
        let currentDate = new Date();

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

    return (
        <div className="bg-surface/30 rounded-2xl border border-white/5 p-6 animate-in fade-in duration-700 w-full max-w-md mx-auto">
            <h3 className="text-lg font-serif text-white/90 mb-4 text-center">Consistency</h3>

            <div className="grid grid-cols-7 gap-2">
                {days.map((date, i) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isActive = activeDates.has(dateStr);

                    return (
                        <div
                            key={i}
                            title={date.toDateString()}
                            className={`
                                aspect-square rounded-md border transition-all duration-300
                                ${isActive
                                    ? 'bg-accent/20 border-accent/50 shadow-[0_0_10px_rgba(45,212,191,0.2)]'
                                    : 'bg-white/5 border-white/5'
                                }
                                flex items-center justify-center
                            `}
                        >
                            {isActive && (
                                <span className="text-accent text-xs">×</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 text-center">
                <p className="text-xs text-accent font-mono uppercase tracking-widest">
                    Current Streak: <span className="font-bold text-lg">{streak}</span> Day{streak !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
}
