import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Trophy, Flame, Sparkles, Activity, Coins, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gamepad2, Crown, Gift, Skull } from "lucide-react";

const GRID_W = 30;
const GRID_H = 20;
const TICK_MS = 120;
const CHAINS = ["ETH", "SOL", "STX"] as const;
type Chain = typeof CHAINS[number];

const CHAIN_COLORS: Record<Chain, string> = {
  ETH: "hsl(185,100%,50%)",
  SOL: "hsl(280,100%,60%)",
  STX: "hsl(30,100%,55%)",
};

const PLAYER_COLOR = "hsl(120,100%,55%)";

interface Seg { x: number; y: number; }
interface Dir { dx: number; dy: number; }

interface Snake {
  segments: Seg[];
  direction: Dir;
  chain: Chain | "PLAYER";
  alive: boolean;
}

interface Treasure {
  x: number;
  y: number;
  chain: Chain;
  value: number;
  type: "normal" | "golden" | "skull";
}

type GameState = "menu" | "playing" | "gameover";

function occupied(snakes: Snake[], treasures: Treasure[]): Set<string> {
  const set = new Set<string>();
  for (const s of snakes) for (const seg of s.segments) set.add(`${seg.x},${seg.y}`);
  for (const t of treasures) set.add(`${t.x},${t.y}`);
  return set;
}

function spawnTreasure(snakes: Snake[], existing: Treasure[]): Treasure {
  const occ = occupied(snakes, existing);
  let x: number, y: number;
  do {
    x = Math.floor(Math.random() * GRID_W);
    y = Math.floor(Math.random() * GRID_H);
  } while (occ.has(`${x},${y}`));
  const roll = Math.random();
  const type = roll < 0.08 ? "skull" : roll < 0.2 ? "golden" : "normal";
  const value = type === "golden" ? 5 : type === "skull" ? -3 : Math.floor(Math.random() * 3) + 1;
  return { x, y, chain: CHAINS[Math.floor(Math.random() * 3)], value, type };
}

function createAISnake(chain: Chain, startY: number): Snake {
  const segs: Seg[] = [];
  for (let i = 4; i >= 0; i--) segs.push({ x: i + 1, y: startY });
  return { segments: segs, direction: { dx: 1, dy: 0 }, chain, alive: true };
}

function createPlayerSnake(): Snake {
  const segs: Seg[] = [];
  for (let i = 4; i >= 0; i--) segs.push({ x: GRID_W - 2 - i, y: Math.floor(GRID_H / 2) });
  return { segments: segs, direction: { dx: -1, dy: 0 }, chain: "PLAYER", alive: true };
}

export default function OmegaSerpent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirRef = useRef<Dir>({ dx: -1, dy: 0 });
  const gameLoopRef = useRef<number | null>(null);

  const [gameState, setGameState] = useState<GameState>("menu");
  const [selectedChain, setSelectedChain] = useState<Chain>("ETH");
  const [player, setPlayer] = useState<Snake>(createPlayerSnake());
  const [aiSnakes, setAiSnakes] = useState<Snake[]>([]);
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [score, setScore] = useState(0);
  const [ergotropy, setErgotropy] = useState(0);
  const [berryPhase, setBerryPhase] = useState(0);
  const [treasuresCollected, setTreasuresCollected] = useState(0);
  const [milestones, setMilestones] = useState(0);
  const [superMilestones, setSuperMilestones] = useState(0);
  const [survivalTicks, setSurvivalTicks] = useState(0);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [lives, setLives] = useState(3);

  const stateRef = useRef({ player, aiSnakes, treasures, score, ergotropy, berryPhase, treasuresCollected, milestones, superMilestones, survivalTicks, lives, tick });
  useEffect(() => {
    stateRef.current = { player, aiSnakes, treasures, score, ergotropy, berryPhase, treasuresCollected, milestones, superMilestones, survivalTicks, lives, tick };
  });

  const { data: leaderboard } = useQuery<any[]>({
    queryKey: ["/api/game/leaderboard"],
    refetchInterval: 15000,
  });

  const { data: myScores } = useQuery<any[]>({
    queryKey: ["/api/game/scores"],
  });

  const saveScoreMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/game/score", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/scores"] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/game/claim/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game/scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game/leaderboard"] });
      toast({ title: "SKYNT Claimed!", description: "Reward deposited to your SphinxOS wallet" });
    },
  });

  const addEvent = useCallback((msg: string) => {
    setEventLog(prev => [msg, ...prev].slice(0, 8));
  }, []);

  const endGame = useCallback(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    gameLoopRef.current = null;
    setGameState("gameover");
    const s = stateRef.current;
    const skyntEarned = (s.score * 0.1).toFixed(2);
    saveScoreMutation.mutate({
      score: s.score,
      skyntEarned,
      ergotropy: Math.floor(s.ergotropy),
      berryPhase: s.berryPhase.toFixed(4),
      treasuresCollected: s.treasuresCollected,
      milestones: s.milestones,
      superMilestones: s.superMilestones,
      survivalTicks: s.survivalTicks,
      chain: selectedChain,
    });
  }, [selectedChain, saveScoreMutation]);

  const startGame = useCallback(() => {
    const p = createPlayerSnake();
    dirRef.current = { dx: -1, dy: 0 };
    const ais = [createAISnake("ETH", 3), createAISnake("SOL", 10), createAISnake("STX", 17)];
    const initTreasures: Treasure[] = [];
    const allSnakes = [p, ...ais];
    for (let i = 0; i < 6; i++) initTreasures.push(spawnTreasure(allSnakes, initTreasures));
    setPlayer(p);
    setAiSnakes(ais);
    setTreasures(initTreasures);
    setScore(0);
    setErgotropy(0);
    setBerryPhase(0);
    setTreasuresCollected(0);
    setMilestones(0);
    setSuperMilestones(0);
    setSurvivalTicks(0);
    setEventLog([]);
    setTick(0);
    setLives(3);
    setGameState("playing");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = dirRef.current;
      switch (e.key) {
        case "ArrowUp": case "w": case "W":
          if (cur.dy !== 1) dirRef.current = { dx: 0, dy: -1 };
          e.preventDefault();
          break;
        case "ArrowDown": case "s": case "S":
          if (cur.dy !== -1) dirRef.current = { dx: 0, dy: 1 };
          e.preventDefault();
          break;
        case "ArrowLeft": case "a": case "A":
          if (cur.dx !== 1) dirRef.current = { dx: -1, dy: 0 };
          e.preventDefault();
          break;
        case "ArrowRight": case "d": case "D":
          if (cur.dx !== -1) dirRef.current = { dx: 1, dy: 0 };
          e.preventDefault();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;

    const loop = setInterval(() => {
      setTick(t => t + 1);
      setSurvivalTicks(t => t + 1);

      setPlayer(prev => {
        if (!prev.alive) return prev;
        const p = { ...prev, segments: [...prev.segments], direction: dirRef.current };
        const head = p.segments[0];
        const nx = (head.x + p.direction.dx + GRID_W) % GRID_W;
        const ny = (head.y + p.direction.dy + GRID_H) % GRID_H;

        const selfHit = p.segments.some((seg, i) => i > 0 && seg.x === nx && seg.y === ny);
        const aiHit = stateRef.current.aiSnakes.some(ai => ai.alive && ai.segments.some(seg => seg.x === nx && seg.y === ny));

        if (selfHit || aiHit) {
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              addEvent("💀 PLAYER TERMINATED — GAME OVER");
              setTimeout(() => endGame(), 100);
              return 0;
            }
            addEvent(`💥 COLLISION! Lives remaining: ${newLives}`);
            const fresh = createPlayerSnake();
            fresh.direction = dirRef.current;
            setPlayer(fresh);
            return newLives;
          });
          return prev;
        }

        p.segments.unshift({ x: nx, y: ny });

        setTreasures(prevT => {
          const hit = prevT.findIndex(t => t.x === nx && t.y === ny);
          if (hit >= 0) {
            const t = prevT[hit];
            if (t.type === "skull") {
              setScore(s => Math.max(0, s + t.value * 10));
              setErgotropy(e => Math.max(0, e + t.value));
              addEvent(`☠️ SKULL TRAP — penalty ${t.value * 10}`);
              if (p.segments.length > 3) p.segments.pop();
            } else {
              const points = t.type === "golden" ? t.value * 20 : t.value * 10;
              setScore(s => s + points);
              setErgotropy(e => {
                const newE = e + t.value * 3;
                const newM = Math.floor(newE / 50);
                setMilestones(pm => {
                  if (newM > pm) addEvent(`⚡ MILESTONE #${newM} — +${t.value * 30} SKYNT BONUS`);
                  return newM;
                });
                const newSM = Math.floor(newE / 500);
                setSuperMilestones(psm => {
                  if (newSM > psm) addEvent(`🏆 SUPER MILESTONE #${newSM} — OMEGA NFT TRIGGER`);
                  return newSM;
                });
                return newE;
              });
              setBerryPhase(bp => bp + (2 * Math.PI / 3) * t.value);
              setTreasuresCollected(tc => tc + 1);
              addEvent(`${t.type === "golden" ? "✨" : "🐍"} Collected ${t.chain} ${t.type === "golden" ? "GOLDEN " : ""}treasure [+${points}]`);
            }
            const remaining = [...prevT];
            remaining.splice(hit, 1);
            remaining.push(spawnTreasure([p, ...stateRef.current.aiSnakes], remaining));
            return remaining;
          }
          p.segments.pop();
          return prevT;
        });

        return p;
      });

      setAiSnakes(prevAis => {
        return prevAis.map(ai => {
          if (!ai.alive) return ai;
          const s = { ...ai, segments: [...ai.segments] };

          const head = s.segments[0];
          const nearestTreasure = stateRef.current.treasures
            .filter(t => t.type !== "skull")
            .sort((a, b) => {
              const da = Math.abs(a.x - head.x) + Math.abs(a.y - head.y);
              const db = Math.abs(b.x - head.x) + Math.abs(b.y - head.y);
              return da - db;
            })[0];

          if (nearestTreasure && Math.random() < 0.7) {
            const dx = nearestTreasure.x - head.x;
            const dy = nearestTreasure.y - head.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              const nd: Dir = { dx: dx > 0 ? 1 : -1, dy: 0 };
              if (!(nd.dx === -s.direction.dx && nd.dy === -s.direction.dy)) s.direction = nd;
            } else {
              const nd: Dir = { dx: 0, dy: dy > 0 ? 1 : -1 };
              if (!(nd.dx === -s.direction.dx && nd.dy === -s.direction.dy)) s.direction = nd;
            }
          } else if (Math.random() < 0.2) {
            const turns: Dir[] = [
              { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            ].filter(d => !(d.dx === -s.direction.dx && d.dy === -s.direction.dy));
            s.direction = turns[Math.floor(Math.random() * turns.length)];
          }

          const nx = (head.x + s.direction.dx + GRID_W) % GRID_W;
          const ny = (head.y + s.direction.dy + GRID_H) % GRID_H;
          s.segments.unshift({ x: nx, y: ny });

          setTreasures(prevT => {
            const hit = prevT.findIndex(t => t.x === nx && t.y === ny);
            if (hit >= 0) {
              const remaining = [...prevT];
              remaining.splice(hit, 1);
              remaining.push(spawnTreasure([stateRef.current.player, ...prevAis], remaining));
              return remaining;
            }
            s.segments.pop();
            return prevT;
          });

          return s;
        });
      });
    }, TICK_MS);

    gameLoopRef.current = loop as unknown as number;
    return () => clearInterval(loop);
  }, [gameState, addEvent, endGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const cellW = rect.width / GRID_W;
    const cellH = rect.height / GRID_H;

    ctx.fillStyle = "rgba(0,0,0,0.92)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(0,243,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellW, 0); ctx.lineTo(x * cellW, rect.height); ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellH); ctx.lineTo(rect.width, y * cellH); ctx.stroke();
    }

    for (const t of treasures) {
      const tx = t.x * cellW + cellW / 2;
      const ty = t.y * cellH + cellH / 2;
      const pulse = Math.sin(tick * 0.15) * 0.3 + 0.7;
      if (t.type === "skull") {
        ctx.shadowColor = "hsl(0,100%,50%)";
        ctx.shadowBlur = 6 * pulse;
        ctx.fillStyle = "hsl(0,100%,50%)";
        ctx.font = `${Math.min(cellW, cellH) * 0.6}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☠", tx, ty);
      } else if (t.type === "golden") {
        ctx.shadowColor = "hsl(50,100%,60%)";
        ctx.shadowBlur = 10 * pulse;
        ctx.fillStyle = "hsl(50,100%,60%)";
        ctx.beginPath();
        const r = Math.min(cellW, cellH) * 0.35;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI / 5);
          const px = tx + Math.cos(a) * r;
          const py = ty + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          const ia = a + Math.PI / 5;
          ctx.lineTo(tx + Math.cos(ia) * r * 0.4, ty + Math.sin(ia) * r * 0.4);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.shadowColor = CHAIN_COLORS[t.chain];
        ctx.shadowBlur = 8 * pulse;
        ctx.fillStyle = CHAIN_COLORS[t.chain];
        ctx.beginPath();
        const r = Math.min(cellW, cellH) * 0.3;
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI / 4) + (i * Math.PI / 2);
          const px = tx + Math.cos(a) * r;
          const py = ty + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    const drawSnake = (snake: Snake, color: string) => {
      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const alpha = 0.3 + 0.7 * (1 - i / snake.segments.length);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        const pad = i === 0 ? 1 : 2;
        ctx.fillRect(seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2);
        if (i === 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
          ctx.fillRect(seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2);
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
      const head = snake.segments[0];
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.min(cellW, cellH) * 0.5}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = snake.chain === "PLAYER" ? "P" : (snake.chain as string)[0];
      ctx.fillText(label, head.x * cellW + cellW / 2, head.y * cellH + cellH / 2);
    };

    for (const ai of aiSnakes) {
      if (ai.alive) drawSnake(ai, CHAIN_COLORS[ai.chain as Chain]);
    }
    if (player.alive) drawSnake(player, PLAYER_COLOR);
  }, [player, aiSnakes, treasures, tick]);

  const skyntReward = (score * 0.1).toFixed(2);
  const quantumProof = ergotropy > 0
    ? `0x${Math.floor((berryPhase + ergotropy) * 1e6).toString(16).slice(0, 16)}`
    : "0x0";

  return (
    <div className="space-y-6" data-testid="omega-serpent-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-widest text-neon-green" data-testid="text-page-title">
            OMEGA SERPENT ARENA
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            PLAY-TO-EARN // COLLECT TREASURES // EARN SKYNT ON-CHAIN
          </p>
        </div>
        <Badge variant="outline" className={`text-sm ${gameState === "playing" ? "border-neon-green text-neon-green animate-pulse" : "text-muted-foreground"}`}>
          {gameState === "playing" ? "LIVE" : gameState === "gameover" ? "GAME OVER" : "READY"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="cosmic-card bg-black/70 border-neon-green/30 overflow-hidden">
            <CardContent className="p-0 relative">
              <div style={{ aspectRatio: `${GRID_W}/${GRID_H}` }} data-testid="game-arena">
                <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: "pixelated" }} />

                {gameState === "menu" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                    <Gamepad2 className="w-12 h-12 text-neon-green mb-3 animate-pulse" />
                    <h2 className="font-heading text-xl text-neon-green tracking-widest mb-2">OMEGA SERPENT v3.0</h2>
                    <p className="font-mono text-xs text-muted-foreground mb-4 text-center max-w-sm">
                      Control your serpent with WASD or Arrow keys. Collect treasures to earn SKYNT. Avoid AI serpents and skull traps.
                    </p>
                    <div className="flex gap-2 mb-4">
                      {CHAINS.map(c => (
                        <button
                          key={c}
                          data-testid={`select-chain-${c.toLowerCase()}`}
                          className={`px-3 py-1.5 rounded-sm font-heading text-xs tracking-wider border transition-all ${selectedChain === c ? "border-neon-green text-neon-green bg-neon-green/10" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
                          onClick={() => setSelectedChain(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <Button
                      data-testid="button-start-game"
                      className="bg-gradient-to-r from-neon-cyan via-neon-green to-neon-orange text-black font-heading font-bold tracking-widest px-8"
                      onClick={startGame}
                    >
                      DEPLOY SERPENT
                    </Button>
                    <div className="flex items-center gap-4 mt-4 font-mono text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />W</span>
                      <span className="flex items-center gap-1"><ArrowLeft className="w-3 h-3" />A</span>
                      <span className="flex items-center gap-1"><ArrowDown className="w-3 h-3" />S</span>
                      <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />D</span>
                    </div>
                  </div>
                )}

                {gameState === "gameover" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-10">
                    <Skull className="w-10 h-10 text-red-500 mb-2" />
                    <h2 className="font-heading text-xl text-red-400 tracking-widest mb-1">GAME OVER</h2>
                    <div className="text-center space-y-1 mb-4">
                      <p className="font-mono text-lg text-neon-green">SCORE: {score}</p>
                      <p className="font-mono text-sm text-neon-cyan">SKYNT EARNED: {skyntReward}</p>
                      <p className="font-mono text-xs text-muted-foreground">Ergotropy: {Math.floor(ergotropy)} | Milestones: {milestones}</p>
                    </div>
                    <Button
                      data-testid="button-play-again"
                      className="bg-gradient-to-r from-neon-cyan via-neon-green to-neon-orange text-black font-heading font-bold tracking-widest px-8"
                      onClick={startGame}
                    >
                      PLAY AGAIN
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {gameState === "playing" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="cosmic-card-cyan p-3">
                <div className="font-mono text-[10px] text-neon-cyan/70 uppercase">Score</div>
                <div className="font-heading text-lg text-neon-cyan" data-testid="text-score">{score}</div>
              </div>
              <div className="cosmic-card-green p-3">
                <div className="font-mono text-[10px] text-neon-green/70 uppercase">SKYNT Reward</div>
                <div className="font-heading text-lg text-neon-green flex items-center gap-1"><Coins className="w-4 h-4" />{skyntReward}</div>
              </div>
              <div className="cosmic-card-orange p-3">
                <div className="font-mono text-[10px] text-neon-orange/70 uppercase">Ergotropy</div>
                <div className="font-heading text-lg text-neon-orange">{Math.floor(ergotropy)}</div>
              </div>
              <div className="cosmic-card-magenta p-3">
                <div className="font-mono text-[10px] text-neon-magenta/70 uppercase">Lives</div>
                <div className="font-heading text-lg text-neon-magenta">{"♥".repeat(lives)}</div>
              </div>
            </div>
          )}

          <Card className="cosmic-card bg-black/50 border-primary/10">
            <CardHeader className="py-3 border-b border-primary/10">
              <div className="flex justify-between items-center">
                <CardTitle className="font-heading text-sm tracking-widest text-primary">EVENT FEED</CardTitle>
                <Activity className="w-4 h-4 text-primary/40" />
              </div>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-0.5 font-mono text-[11px] min-h-[80px]" data-testid="game-event-feed">
                {eventLog.length > 0 ? eventLog.map((msg, i) => (
                  <p key={i} className={`${i === 0 ? "text-neon-green" : "text-primary/50"} truncate`}>{">>>"} {msg}</p>
                )) : (
                  <p className="text-muted-foreground/40 italic">Awaiting serpent deployment...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {gameState === "playing" && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase text-primary/60">
                <span>Cross-Chain Ergotropy</span>
                <span className="text-foreground">{Math.floor(ergotropy)} / {(superMilestones + 1) * 500}</span>
              </div>
              <Progress value={(ergotropy % 500) / 5} className="h-2 bg-white/5 [&>div]:bg-gradient-to-r [&>div]:from-neon-cyan [&>div]:via-neon-magenta [&>div]:to-neon-orange" />
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">GHZ Quantum Proof</span>
                <span className="text-neon-cyan">{quantumProof}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="cosmic-card bg-black/60 border-primary/20">
            <CardHeader className="py-3 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-neon-orange" />
                <CardTitle className="font-heading text-sm tracking-widest text-primary">LEADERBOARD</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-1.5" data-testid="leaderboard">
                {leaderboard && leaderboard.length > 0 ? leaderboard.slice(0, 10).map((entry: any, i: number) => (
                  <div key={entry.id} className={`flex items-center justify-between p-2 rounded-sm ${i === 0 ? "bg-neon-orange/10 border border-neon-orange/30" : i < 3 ? "bg-primary/5 border border-primary/10" : "border border-transparent"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-heading text-xs w-5 text-center ${i === 0 ? "text-neon-orange" : i < 3 ? "text-neon-cyan" : "text-muted-foreground"}`}>
                        {i === 0 ? "👑" : `#${i + 1}`}
                      </span>
                      <span className="font-mono text-xs text-foreground truncate max-w-[80px]">{entry.username}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-neon-green">{entry.score}</span>
                      <span className="font-mono text-[9px] text-muted-foreground ml-1">({entry.chain})</span>
                    </div>
                  </div>
                )) : (
                  <p className="font-mono text-xs text-muted-foreground/50 text-center py-4">No scores yet. Be the first!</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card bg-black/60 border-primary/20">
            <CardHeader className="py-3 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-neon-green" />
                <CardTitle className="font-heading text-sm tracking-widest text-primary">MY REWARDS</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-2" data-testid="my-rewards">
                {myScores && myScores.length > 0 ? myScores.slice(0, 5).map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 bg-black/30 border border-white/5 rounded-sm">
                    <div>
                      <div className="font-mono text-xs text-foreground">Score: {entry.score}</div>
                      <div className="font-mono text-[9px] text-muted-foreground">{entry.chain} | {parseFloat(entry.skyntEarned).toFixed(2)} SKYNT</div>
                    </div>
                    {entry.claimed ? (
                      <Badge variant="outline" className="text-[9px] border-neon-green/30 text-neon-green">CLAIMED</Badge>
                    ) : (
                      <Button
                        size="sm"
                        data-testid={`button-claim-${entry.id}`}
                        className="text-[10px] h-6 px-2 bg-neon-green/20 border border-neon-green/40 text-neon-green hover:bg-neon-green/30"
                        onClick={() => claimMutation.mutate(entry.id)}
                        disabled={claimMutation.isPending}
                      >
                        CLAIM
                      </Button>
                    )}
                  </div>
                )) : (
                  <p className="font-mono text-xs text-muted-foreground/50 text-center py-4">Play to earn rewards!</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="cosmic-card bg-black/60 border-primary/20">
            <CardHeader className="py-3 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
                <CardTitle className="font-heading text-sm tracking-widest text-primary">HOW TO PLAY</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                <p><span className="text-neon-green">WASD</span> or <span className="text-neon-green">Arrow Keys</span> to steer</p>
                <p><span style={{ color: CHAIN_COLORS.ETH }}>◆</span> Chain treasures = points + growth</p>
                <p><span className="text-yellow-400">★</span> Golden treasures = 5x points</p>
                <p><span className="text-red-500">☠</span> Skull traps = point penalty + shrink</p>
                <p><span className="text-neon-orange">⚡</span> Milestone every 50 ergotropy</p>
                <p><span className="text-neon-magenta">🏆</span> Super milestone every 500</p>
                <p className="border-t border-white/5 pt-2 text-neon-cyan">Score × 0.1 = SKYNT earned on-chain</p>
                <p className="text-neon-green">3 lives per game. Claim SKYNT rewards to your SphinxOS wallet!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
