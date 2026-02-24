import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, Users, Layers, Activity, BarChart3, PieChart as PieChartIcon } from "lucide-react";

const mintVolumeData = [
  { date: "Jan", volume: 120, revenue: 2.4 },
  { date: "Feb", volume: 340, revenue: 6.8 },
  { date: "Mar", volume: 580, revenue: 11.6 },
  { date: "Apr", volume: 420, revenue: 8.4 },
  { date: "May", volume: 710, revenue: 14.2 },
  { date: "Jun", volume: 890, revenue: 17.8 },
  { date: "Jul", volume: 1050, revenue: 21.0 },
  { date: "Aug", volume: 780, revenue: 15.6 },
  { date: "Sep", volume: 920, revenue: 18.4 },
  { date: "Oct", volume: 1340, revenue: 26.8 },
  { date: "Nov", volume: 1580, revenue: 31.6 },
  { date: "Dec", volume: 1820, revenue: 36.4 },
];

const topHolders = [
  { address: "0x7a3f...8d2e", holdings: 142, percentage: 14.2 },
  { address: "0x9b1c...4f7a", holdings: 98, percentage: 9.8 },
  { address: "0x2e5d...1c3b", holdings: 76, percentage: 7.6 },
  { address: "0x4f8a...9e2d", holdings: 61, percentage: 6.1 },
  { address: "0x6c3e...7b5a", holdings: 54, percentage: 5.4 },
  { address: "0x1d9f...3a8c", holdings: 47, percentage: 4.7 },
  { address: "0x8e2b...6d4f", holdings: 39, percentage: 3.9 },
  { address: "0x5a7c...2e1d", holdings: 33, percentage: 3.3 },
];

const rarityDistribution = [
  { name: "Common", value: 450, color: "hsl(210 100% 55%)" },
  { name: "Uncommon", value: 280, color: "hsl(145 100% 50%)" },
  { name: "Rare", value: 150, color: "hsl(185 100% 50%)" },
  { name: "Epic", value: 80, color: "hsl(300 100% 60%)" },
  { name: "Legendary", value: 40, color: "hsl(45 100% 50%)" },
];

const dailyActivity = [
  { day: "Mon", mints: 45, transfers: 23, burns: 5 },
  { day: "Tue", mints: 62, transfers: 34, burns: 8 },
  { day: "Wed", mints: 38, transfers: 19, burns: 3 },
  { day: "Thu", mints: 71, transfers: 41, burns: 12 },
  { day: "Fri", mints: 89, transfers: 52, burns: 7 },
  { day: "Sat", mints: 56, transfers: 28, burns: 4 },
  { day: "Sun", mints: 42, transfers: 21, burns: 6 },
];

const tooltipStyle = {
  background: "hsl(220 25% 7%)",
  border: "1px solid hsl(210 20% 15%)",
  borderRadius: "4px",
  fontSize: "12px",
};

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");

  const stats = [
    { label: "Total Minted", value: "9,650", change: "+12.4%", positive: true, icon: Layers, color: "neon-cyan" },
    { label: "Unique Holders", value: "2,847", change: "+8.2%", positive: true, icon: Users, color: "neon-green" },
    { label: "Floor Price", value: "0.42 ETH", change: "-3.1%", positive: false, icon: TrendingUp, color: "neon-orange" },
    { label: "24h Volume", value: "18.6 ETH", change: "+22.7%", positive: true, icon: Activity, color: "neon-magenta" },
  ];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading neon-glow-cyan" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Collection performance & insights</p>
        </div>
        <div className="flex gap-1 bg-black/40 rounded-sm border border-border p-1">
          {(["7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              data-testid={`button-range-${range}`}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-heading uppercase tracking-wider rounded-sm transition-all ${
                timeRange === range
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`cosmic-card cosmic-card-${stat.color.replace("neon-", "")} p-4`} data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{stat.label}</span>
              <stat.icon className={`w-4 h-4 text-${stat.color}`} />
            </div>
            <div className="stat-value">{stat.value}</div>
            <span className={`stat-change ${stat.positive ? "positive" : "negative"}`}>
              {stat.change}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cosmic-card cosmic-card-cyan p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-neon-cyan" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-minting-volume">Minting Volume</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mintVolumeData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(185 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(185 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="volume" stroke="hsl(185 100% 50%)" fill="url(#volumeGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-magenta p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4 text-neon-magenta" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-rarity-distribution">Rarity Distribution</h3>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rarityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {rarityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {rarityDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cosmic-card cosmic-card-green p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-neon-green" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-daily-activity">Daily Activity</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity}>
                <XAxis dataKey="day" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="mints" fill="hsl(145 100% 50%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="transfers" fill="hsl(185 100% 50%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="burns" fill="hsl(0 100% 60%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-neon-green" /> Mints</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-neon-cyan" /> Transfers</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-plasma-red" /> Burns</div>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-orange p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-neon-orange" />
            <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-top-holders">Top Holders</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Address</th>
                <th>Holdings</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {topHolders.map((holder, i) => (
                <tr key={holder.address} data-testid={`row-holder-${i}`}>
                  <td className="text-muted-foreground">{i + 1}</td>
                  <td className="text-primary">{holder.address}</td>
                  <td>{holder.holdings}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${holder.percentage * 5}%`,
                            background: `linear-gradient(90deg, hsl(30 100% 55%), hsl(45 100% 50%))`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground">{holder.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cosmic-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-neon-cyan" />
          <h3 className="font-heading text-sm uppercase tracking-wider" data-testid="text-revenue-trend">Revenue Trend (ETH)</h3>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mintVolumeData}>
              <XAxis dataKey="date" stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(220 15% 50%)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(300 100% 60%)" strokeWidth={2} dot={{ fill: "hsl(300 100% 60%)", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
