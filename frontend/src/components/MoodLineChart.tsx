import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { main } from "../../wailsjs/go/models";

interface MoodLineChartProps {
    entries: main.Entry[];
}

export function MoodLineChart({ entries }: MoodLineChartProps) {
    const getMoodScore = (emotions: string[]): number | null => {
        if (!emotions || emotions.length === 0) return null;

        const map: Record<string, number> = {
            "Joy": 9, "Happy": 8, "Excited": 8, "Hopeful": 8, "Proud": 8,
            "Calm": 6, "Peaceful": 6, "Relieved": 6, "Gratitude": 7,
            "Neutral": 5, "Bored": 5, "Tired": 4,
            "Sad": 3, "Lonely": 3, "Disappointed": 3,
            "Anxious": 2, "Fear": 2, "Nervous": 2,
            "Angry": 1, "Frustrated": 2, "Overwhelmed": 2
        };

        let sum = 0;
        let count = 0;
        for (const e of emotions) {
            const key = e.trim();
            let val = map[key] || map[Object.keys(map).find(k => k.toLowerCase() === key.toLowerCase()) || ""] || 5;
            if (val) {
                sum += val;
                count++;
            }
        }
        return count > 0 ? sum / count : 5;
    };

    const data = [...entries]
        .slice(0, 30)
        .reverse()
        .map(entry => ({
            id: entry.id,
            date: new Date(entry.created_at).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
            score: getMoodScore(entry.emotions)
        }));
    const scoredData = data.filter((entry) => typeof entry.score === "number");
    const averageScore = scoredData.length > 0
        ? scoredData.reduce((sum, entry) => sum + (entry.score || 0), 0) / scoredData.length
        : null;
    const moodLabel = averageScore === null ? "Waiting" : averageScore >= 7 ? "Lighter" : averageScore >= 4 ? "Steady" : "Heavy";

    return (
        <div className="app-panel rounded-[28px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="eyebrow">Trend</p>
                    <h3 className="section-title mt-2 text-[1.65rem]">Emotional tone</h3>
                </div>
                <div className="pill-chip">
                    <span className="text-sm font-semibold text-[var(--accent-strong)]">{moodLabel}</span>
                </div>
            </div>

            {scoredData.length === 0 ? (
                <div className="mt-5 flex min-h-[250px] items-center justify-center rounded-[24px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.42)] px-6 text-center">
                    <p className="max-w-xs text-sm leading-7 text-[var(--muted)]">No data yet.</p>
                </div>
            ) : (
                <div className="mt-5 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="pill-chip">
                            Avg {averageScore?.toFixed(1)}
                        </div>
                        <div className="pill-chip">
                            {scoredData.length} entries
                        </div>
                    </div>

                    <div className="h-[250px] w-full rounded-[24px] bg-[rgba(255,255,255,0.48)] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="rgba(79,96,82,0.1)" />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: "#778377", fontSize: 11 }}
                                />
                                <YAxis
                                    domain={[0, 10]}
                                    width={30}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: "#778377", fontSize: 11 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(255, 255, 255, 0.94)",
                                        borderColor: "rgba(79,96,82,0.14)",
                                        borderRadius: "16px",
                                        boxShadow: "0 16px 30px rgba(63,78,66,0.12)",
                                    }}
                                    itemStyle={{ color: "#425347" }}
                                    formatter={(value) => [typeof value === "number" ? value.toFixed(1) : "0.0", "Mood score"]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#5d7563"
                                    strokeWidth={3}
                                    connectNulls={true}
                                    dot={false}
                                    activeDot={{ r: 5, fill: "#415247", stroke: "#f8f5ef", strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
