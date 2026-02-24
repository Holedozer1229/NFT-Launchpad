import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import {
  Activity, Cpu, Box, DollarSign, Clock, TrendingUp,
  TrendingDown, Zap, ChevronUp, ChevronDown
} from "lucide-react";

function generateHashrateData() {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    data.push({
      time: `${t.getHours().toString().padStart(2, "0")}:00`,
      hashrate: 900 + Math.random() * 600,
    });
  }
  return data;
}

function generateBlocksData() {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    data.push({
      time: `${t.getHours().toString().padStart(2, "0")}:00`,
      blocks: Math.floor(Math.random() * 12) + 2,
    });
  }
  return data;
}

const MINERS = [
  { id: "miner-alpha", lang: "Rust", status: "online", hashrate: 542, blocks: 89, accepted: 1247, rejected: 3 },
  { id: "miner-beta", lang: "Python", status: "online", hashrate: 318, blocks: 41, accepted: 876, rejected: 12 },
  { id: "miner-gamma", lang: "Rust", status: "idle", hashrate: 0, blocks: 17, accepted: 423, rejected: 1 },
];

const EMISSION_TABLE = [
  { epoch: "Current", reward: "6.25 ETH", rate: "~900/day" },
  { epoch: "Next", reward: "3.125 ETH", rate: "~900/day" },
  { epoch: "Future", reward: "1.5625 ETH", rate: "~900/day" },
];

interface StatCardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  accent: string;
}

function StatCard({ label, value, change, icon, accent }: StatCardProps) {
  const positive = change >= 0;
  return (
    <div className={`cosmic-card cosmic-card-${accent} p-5`} data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="stat-label">{label}</span>
          <div className="stat-value">{value}</div>
        </div>
        <div className={`p-2 rounded-sm bg-neon-${accent}/10`}>{icon}</div>
      </div>
      <div className={`stat-change ${positive ? "positive" : "negative"} flex items-center gap-1 mt-2`}>
        {positive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}% from last hour
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [hashrate, setHashrate] = useState(1.2);
  const [blocksFound, setBlocksFound] = useState(147);
  const [revenue, setRevenue] = useState(2.84);
  const [uptimeSeconds, setUptimeSeconds] = useState(45240);
  const [hashrateData, setHashrateData] = useState(generateHashrateData);
  const [blocksData, setBlocksData] = useState(generateBlocksData);
  const [difficulty, setDifficulty] = useState(4218);
  const [halvingDays, setHalvingDays] = useState(42);
  const [halvingHours, setHalvingHours] = useState(18);
  const [halvingMinutes, setHalvingMinutes] = useState(33);
  const [miners, setMiners] = useState(MINERS);

  useEffect(() => {
    const interval = setInterval(() => {
      setHashrate(prev => +(prev + (Math.random() - 0.48) * 0.05).toFixed(2));
      setBlocksFound(prev => prev + (Math.random() < 0.3 ? 1 : 0));
      setRevenue(prev => +(prev + Math.random() * 0.01).toFixed(3));
      setUptimeSeconds(prev => prev + 3);
      setDifficulty(prev => Math.min(6000, Math.max(3000, prev + Math.floor((Math.random() - 0.5) * 20))));

      setHashrateData(prev => {
        const next = [...prev.slice(1)];
        const now = new Date();
        next.push({
          time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
          hashrate: 900 + Math.random() * 600,
        });
        return next;
      });

      setBlocksData(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          blocks: next[next.length - 1].blocks + (Math.random() < 0.2 ? 1 : 0),
        };
        return next;
      });

      setMiners(prev =>
        prev.map(m => ({
          ...m,
          hashrate: m.status === "online" ? Math.max(0, m.hashrate + Math.floor((Math.random() - 0.5) * 30)) : 0,
          accepted: m.status === "online" ? m.accepted + (Math.random() < 0.3 ? 1 : 0) : m.accepted,
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHalvingMinutes(prev => {
        if (prev <= 0) {
          setHalvingHours(h => {
            if (h <= 0) {
              setHalvingDays(d => Math.max(0, d - 1));
              return 23;
            }
            return h - 1;
          });
          return 59;
        }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = useCallback(() => {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }, [uptimeSeconds]);

  const difficultyPercent = (difficulty / 6000) * 100;
  const halvingProgress = ((42 - halvingDays) / 42) * 100;

  return (
    <div className="space-y-6 p-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-widest neon-glow-cyan" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <span className="text-xs font-mono text-muted-foreground" data-testid="text-live-indicator">
          <Activity className="w-3 h-3 inline mr-1 text-neon-green animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Hashrate"
          value={`${hashrate.toFixed(1)} KH/s`}
          change={3.2}
          icon={<Cpu className="w-5 h-5 text-neon-cyan" />}
          accent="cyan"
        />
        <StatCard
          label="Blocks Found"
          value={blocksFound.toString()}
          change={12.5}
          icon={<Box className="w-5 h-5 text-neon-green" />}
          accent="green"
        />
        <StatCard
          label="Revenue"
          value={`${revenue.toFixed(2)} ETH`}
          change={5.8}
          icon={<DollarSign className="w-5 h-5 text-neon-orange" />}
          accent="orange"
        />
        <StatCard
          label="Uptime"
          value={formatUptime()}
          change={-0.3}
          icon={<Clock className="w-5 h-5 text-neon-magenta" />}
          accent="magenta"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cosmic-card cosmic-card-cyan p-5" data-testid="chart-hashrate">
          <h3 className="stat-label mb-4">Live Hashrate</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hashrateData}>
                <defs>
                  <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(185,100%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(185,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,15%)" />
                <XAxis dataKey="time" stroke="#555" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,25%,7%)", border: "1px solid hsl(185,100%,50%,0.3)", borderRadius: "4px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(185,100%,50%)" }}
                />
                <Area type="monotone" dataKey="hashrate" stroke="hsl(185,100%,50%)" fill="url(#hashGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-green p-5" data-testid="chart-blocks">
          <h3 className="stat-label mb-4">Blocks Found (24h)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blocksData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,15%)" />
                <XAxis dataKey="time" stroke="#555" fontSize={10} tickLine={false} axisLine={false} interval={3} />
                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,25%,7%)", border: "1px solid hsl(145,100%,50%,0.3)", borderRadius: "4px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(145,100%,50%)" }}
                />
                <Bar dataKey="blocks" fill="hsl(145,100%,50%)" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cosmic-card cosmic-card-orange p-5" data-testid="card-difficulty">
          <h3 className="stat-label mb-4">Current Difficulty</h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(210,20%,15%)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="hsl(30,100%,55%)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${difficultyPercent * 3.27} 327`}
                  style={{ filter: "drop-shadow(0 0 6px hsl(30,100%,55%,0.5))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-lg text-neon-orange">{difficulty}</span>
                <span className="text-[10px] text-muted-foreground font-mono">/ 6000</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-magenta p-5" data-testid="card-halving">
          <h3 className="stat-label mb-4">Next Halving</h3>
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="text-center">
              <span className="font-heading font-bold text-2xl text-neon-magenta">{halvingDays}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">DAYS</span>
            </div>
            <span className="text-muted-foreground text-lg">:</span>
            <div className="text-center">
              <span className="font-heading font-bold text-2xl text-neon-magenta">{halvingHours}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">HRS</span>
            </div>
            <span className="text-muted-foreground text-lg">:</span>
            <div className="text-center">
              <span className="font-heading font-bold text-2xl text-neon-magenta">{halvingMinutes}</span>
              <span className="block text-[10px] text-muted-foreground font-mono">MIN</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${halvingProgress}%`,
                  background: "linear-gradient(90deg, hsl(300,100%,60%), hsl(280,100%,60%))",
                  boxShadow: "0 0 10px hsl(300,100%,60%,0.5)",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
              <span>Epoch Start</span>
              <span>{halvingProgress.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="cosmic-card cosmic-card-cyan p-5" data-testid="card-emission">
          <h3 className="stat-label mb-4">Emission Rate</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Epoch</th>
                <th>Reward</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {EMISSION_TABLE.map((row) => (
                <tr key={row.epoch}>
                  <td className={row.epoch === "Current" ? "text-neon-cyan" : ""}>{row.epoch}</td>
                  <td>{row.reward}</td>
                  <td>{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cosmic-card p-5" data-testid="table-miners">
        <h3 className="stat-label mb-4">Active Miners</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Miner ID</th>
                <th>Language</th>
                <th>Status</th>
                <th>Hashrate</th>
                <th>Blocks</th>
                <th>Accepted</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {miners.map((m) => (
                <tr key={m.id} data-testid={`row-miner-${m.id}`}>
                  <td className="text-neon-cyan font-semibold">{m.id}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.lang === "Rust" ? "bg-neon-orange/10 text-neon-orange" : "bg-neon-cyan/10 text-neon-cyan"
                    }`}>
                      {m.lang}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1 ${m.status === "online" ? "text-neon-green" : "text-muted-foreground"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === "online" ? "bg-neon-green animate-pulse" : "bg-muted-foreground"}`} />
                      {m.status}
                    </span>
                  </td>
                  <td>{m.hashrate} H/s</td>
                  <td>{m.blocks}</td>
                  <td className="text-neon-green">{m.accepted}</td>
                  <td className="text-red-400">{m.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
