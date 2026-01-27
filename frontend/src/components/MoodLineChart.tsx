import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { main } from "../../wailsjs/go/models";

interface MoodLineChartProps {
    entries: main.Entry[];
}

export function MoodLineChart({ entries }: MoodLineChartProps) {
    // Helper to map emotion tags to an approximate "Valence/Energy" score (1-10)
    // This is a prototype heuristic.
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

    return (
        <div className="bg-surface/30 rounded-2xl border border-white/5 p-6 animate-in fade-in duration-700 w-full max-w-md mx-auto flex flex-col h-full cursor-default select-none outline-none ring-0">
            <h3 className="text-lg font-serif text-white/90 mb-4 text-center">Emotional Trends (Last 30)</h3>

            <div className="flex-1 w-full min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis
                            dataKey="date"
                            hide
                        />
                        <YAxis
                            domain={[0, 10]}
                            width={30}
                            tick={false}
                            axisLine={false}
                            label={{ value: 'Positivity', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 10, textAnchor: 'middle' } }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', color: '#f3f4f6' }}
                            itemStyle={{ color: '#2dd4bf' }}
                            formatter={(value: any) => [value?.toFixed(1) || "0.0", "Mood Score"]}
                        />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#2dd4bf"
                            strokeWidth={3}
                            connectNulls={true}
                            isAnimationActive={false}
                            dot={{ fill: '#0f172a', stroke: '#2dd4bf', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#2dd4bf' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
