"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ROIDataPoint {
  pick: number;
  roi: number;
}

interface ROIChartProps {
  data: ROIDataPoint[];
  height?: number;
  color?: string;
}

export function ROIChart({ data, height = 80, color = "#10b981" }: ROIChartProps) {
  const lastValue = data[data.length - 1]?.roi ?? 0;
  const lineColor = lastValue >= 0 ? color : "#ef4444";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="pick" hide />
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "#0d1119",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "'DM Mono', monospace",
            color: "#dce4f0",
          }}
          formatter={(value: number) => [`${value > 0 ? "+" : ""}${value.toFixed(1)}%`, "ROI"]}
          labelFormatter={(label: number) => `Pick #${label}`}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="roi"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: lineColor }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
