import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const data = [
  { time: "10:00", mints: 12 },
  { time: "11:00", mints: 45 },
  { time: "12:00", mints: 120 },
  { time: "13:00", mints: 88 },
  { time: "14:00", mints: 56 },
  { time: "15:00", mints: 32 },
  { time: "16:00", mints: 14 },
];

export function MintTimeline() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Mint Velocity (Hourly)</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="time" 
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="#888888" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `${value}`} 
            />
            <Tooltip 
              cursor={{fill: 'transparent'}}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px' }}
            />
            <Bar 
              dataKey="mints" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
