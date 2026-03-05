'use client';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

type TrendPoint = { date: string; count: number };

interface Props {
    data: TrendPoint[];
}

export function ResourceTrendChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="resourceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e87722" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#e87722" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis
                    dataKey="date"
                    tick={{ fill: "#6e7681", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: "#6e7681", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    domain={["auto", "auto"]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "#161b22",
                        border: "1px solid #30363d",
                        borderRadius: "4px",
                        fontSize: "12px",
                        color: "#e6edf3",
                    }}
                    itemStyle={{ color: "#e87722" }}
                    cursor={{ stroke: "#30363d" }}
                    formatter={(val: number | undefined) => [val != null ? val.toLocaleString() : "–", "Resources"]}
                />
                <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#e87722"
                    strokeWidth={2}
                    fill="url(#resourceGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#e87722", stroke: "#0d1117", strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
