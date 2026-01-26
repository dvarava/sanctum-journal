import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { main } from "../../wailsjs/go/models";

interface TrendsChartProps {
    entries: main.Entry[];
}

export function TrendsChart({ entries }: TrendsChartProps) {
    // process data: count frequency of each emotion
    const emotionCounts: Record<string, number> = {};

    entries.forEach(entry => {
        if (entry.emotions && Array.isArray(entry.emotions)) {
            entry.emotions.forEach(emotion => {
                const cleanEmotion = emotion.trim();
                if (cleanEmotion) {
                    emotionCounts[cleanEmotion] = (emotionCounts[cleanEmotion] || 0) + 1;
                }
            });
        }
    });

    const data = Object.entries(emotionCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 7); // top 7 emotions

    const colors = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#f87171', '#9ca3af'];

    if (data.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-gray-500 bg-surface/30 rounded-2xl border border-white/5 p-8 text-center">
                <p>No emotional data yet.</p>
                <p className="text-xs mt-2 opacity-60">Analyze your entries to see trends here.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface/30 rounded-2xl border border-white/5 p-6 animate-in fade-in duration-700">
            <h3 className="text-lg font-serif text-white/90 mb-6 flex items-center gap-2">
                <span>Emotion Frequency</span>
                <span className="text-xs font-sans text-gray-500 bg-white/5 px-2 py-1 rounded-full uppercase tracking-wider">All Time</span>
            </h3>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            width={100}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', color: '#f3f4f6' }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
