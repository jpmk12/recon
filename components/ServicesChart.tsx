"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = { data: { service: string; count: number }[] };

export default function ServicesChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No open services discovered yet.</p>;
  }
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222831" />
          <XAxis
            dataKey="service"
            stroke="#8a93a6"
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke="#8a93a6" fontSize={11} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#13171c" }}
            contentStyle={{
              background: "#0b0d10",
              border: "1px solid #222831",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
