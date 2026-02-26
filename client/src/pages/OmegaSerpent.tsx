import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Coins, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gamepad2, Crown, Gift, Skull, X, Trophy, Zap, Volume2, VolumeX } from "lucide-react";

const GRID_W = 50;
const GRID_H = 35;
const TICK_MS = 120;
const CHAINS = ["ETH", "SOL", "STX"] as const;

// Particle system for visual effects
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

// Background star
interface Star {
  x: number; y: number;
  size: number; twinkleSpeed: number; twinkleOffset: number;
  brightness: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 1.5 + 0.5,
    twinkleSpeed: Math.random() * 0.03 + 0.01,
    twinkleOffset: Math.random() * Math.PI * 2,
    brightness: Math.random() * 0.4 + 0.1,
  }));
}

function spawnParticles(x: number, y: number, color: string, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 1,
      color,
      size: Math.random() * 3 + 1,
    };
  });
}

// Web Audio API sound synthesis (AudioContext is created lazily on first user-triggered sound)
let audioCtx: AudioContext | null = null;
let audioMuted = false;
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.08) {
  if (audioMuted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* audio not available */ }
}

function sfxCollect() { playTone(880, 0.1, "square", 0.06); playTone(1100, 0.08, "square", 0.04); }
function sfxGolden() { playTone(1200, 0.12, "sine", 0.07); setTimeout(() => playTone(1600, 0.15, "sine", 0.05), 60); }
function sfxSkull() { playTone(200, 0.2, "sawtooth", 0.08); }
function sfxCollision() { playTone(100, 0.3, "sawtooth", 0.1); playTone(80, 0.4, "square", 0.06); }
function sfxMilestone() { playTone(660, 0.1, "sine", 0.06); setTimeout(() => playTone(880, 0.1, "sine", 0.06), 100); setTimeout(() => playTone(1100, 0.15, "sine", 0.06), 200); }
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

function DPad({ onDir }: { onDir: (d: Dir) => void }) {
  const btnClass = "w-16 h-16 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl bg-white/10 border-2 border-white/20 active:bg-neon-green/30 active:border-neon-green/60 transition-colors select-none";
  const press = (d: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDir(d);
  };
  return (
    <div className="grid grid-cols-3 gap-1.5 w-[210px] sm:w-[180px]" style={{ touchAction: "none" }} data-testid="dpad">
      <div />
      <button type="button" className={btnClass} onPointerDown={press({ dx: 0, dy: -1 })} style={{ touchAction: "none" }} data-testid="dpad-up">
        <ArrowUp className="w-6 h-6 text-white/80 pointer-events-none" />
      </button>
      <div />
      <button type="button" className={btnClass} onPointerDown={press({ dx: -1, dy: 0 })} style={{ touchAction: "none" }} data-testid="dpad-left">
        <ArrowLeft className="w-6 h-6 text-white/80 pointer-events-none" />
      </button>
      <div className="w-16 h-16 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl border border-white/5">
        <Gamepad2 className="w-5 h-5 text-white/20 pointer-events-none" />
      </div>
      <button type="button" className={btnClass} onPointerDown={press({ dx: 1, dy: 0 })} style={{ touchAction: "none" }} data-testid="dpad-right">
        <ArrowRight className="w-6 h-6 text-white/80 pointer-events-none" />
      </button>
      <div />
      <button type="button" className={btnClass} onPointerDown={press({ dx: 0, dy: 1 })} style={{ touchAction: "none" }} data-testid="dpad-down">
        <ArrowDown className="w-6 h-6 text-white/80 pointer-events-none" />
      </button>
      <div />
    </div>
  );
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [muted, setMuted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const [combo, setCombo] = useState(0);
  const lastCollectTickRef = useRef(-999);
  const starsRef = useRef<Star[]>(createStars(120));

  const stateRef = useRef({ player, aiSnakes, treasures, score, ergotropy, berryPhase, treasuresCollected, milestones, superMilestones, survivalTicks, lives, tick });
  useEffect(() => {
    stateRef.current = { player, aiSnakes, treasures, score, ergotropy, berryPhase, treasuresCollected, milestones, superMilestones, survivalTicks, lives, tick };
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const [canvasKey, setCanvasKey] = useState(0);
  useEffect(() => {
    const onResize = () => setCanvasKey(k => k + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

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
      toast({ title: "SKYNT Claimed!", description: "Reward deposited to your SKYNT wallet" });
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
    const ais = [createAISnake("ETH", 5), createAISnake("SOL", 17), createAISnake("STX", 29)];
    const initTreasures: Treasure[] = [];
    const allSnakes = [p, ...ais];
    for (let i = 0; i < 12; i++) initTreasures.push(spawnTreasure(allSnakes, initTreasures));
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
    setShowLeaderboard(false);
    setShowRewards(false);
    setParticles([]);
    setShakeOffset({ x: 0, y: 0 });
    setCombo(0);
    lastCollectTickRef.current = -999;
    setGameState("playing");
  }, []);

  const handleDpadDir = useCallback((d: Dir) => {
    const cur = dirRef.current;
    if (d.dx !== 0 && d.dx !== -cur.dx) dirRef.current = d;
    if (d.dy !== 0 && d.dy !== -cur.dy) dirRef.current = d;
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = dirRef.current;
      switch (e.key) {
        case "ArrowUp": case "w": case "W":
          if (cur.dy !== 1) dirRef.current = { dx: 0, dy: -1 };
          e.preventDefault(); break;
        case "ArrowDown": case "s": case "S":
          if (cur.dy !== -1) dirRef.current = { dx: 0, dy: 1 };
          e.preventDefault(); break;
        case "ArrowLeft": case "a": case "A":
          if (cur.dx !== 1) dirRef.current = { dx: -1, dy: 0 };
          e.preventDefault(); break;
        case "ArrowRight": case "d": case "D":
          if (cur.dx !== -1) dirRef.current = { dx: 1, dy: 0 };
          e.preventDefault(); break;
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

      // Update particles
      setParticles(prev => prev
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.05, life: p.life - (1 / (p.maxLife * 30)) }))
        .filter(p => p.life > 0)
      );

      // Decay screen shake
      setShakeOffset(prev => ({
        x: prev.x * 0.7,
        y: prev.y * 0.7,
      }));

      setPlayer(prev => {
        if (!prev.alive) return prev;
        const p = { ...prev, segments: [...prev.segments], direction: dirRef.current };
        const head = p.segments[0];
        const nx = (head.x + p.direction.dx + GRID_W) % GRID_W;
        const ny = (head.y + p.direction.dy + GRID_H) % GRID_H;
        const selfHit = p.segments.some((seg, i) => i > 0 && seg.x === nx && seg.y === ny);
        const aiHit = stateRef.current.aiSnakes.some(ai => ai.alive && ai.segments.some(seg => seg.x === nx && seg.y === ny));

        if (selfHit || aiHit) {
          sfxCollision();
          setShakeOffset({ x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 });
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cellW = rect.width / GRID_W;
            const cellH = rect.height / GRID_H;
            setParticles(prev => [...prev, ...spawnParticles(nx * cellW + cellW / 2, ny * cellH + cellH / 2, "hsl(0,100%,60%)", 20)]);
          }
          setCombo(0);
          setLives(l => {
            const newLives = l - 1;
            if (newLives <= 0) {
              addEvent("\u{1F480} PLAYER TERMINATED \u2014 GAME OVER");
              setTimeout(() => endGame(), 100);
              return 0;
            }
            addEvent(`\u{1F4A5} COLLISION! Lives remaining: ${newLives}`);
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
              sfxSkull();
              setScore(s => Math.max(0, s + t.value * 10));
              setErgotropy(e => Math.max(0, e + t.value));
              addEvent(`\u2620\uFE0F SKULL TRAP \u2014 penalty ${t.value * 10}`);
              setCombo(0);
              if (p.segments.length > 3) p.segments.pop();
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const cW = rect.width / GRID_W;
                const cH = rect.height / GRID_H;
                setParticles(prev => [...prev, ...spawnParticles(nx * cW + cW / 2, ny * cH + cH / 2, "hsl(0,100%,50%)", 10)]);
              }
              setShakeOffset({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 });
            } else {
              if (t.type === "golden") sfxGolden(); else sfxCollect();
              // Combo tracking
              const curTick = stateRef.current.tick;
              const gap = curTick - lastCollectTickRef.current;
              lastCollectTickRef.current = curTick;
              setCombo(c => gap < 15 ? c + 1 : 1);
              const canvas = canvasRef.current;
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const cW = rect.width / GRID_W;
                const cH = rect.height / GRID_H;
                const pColor = t.type === "golden" ? "hsl(50,100%,60%)" : CHAIN_COLORS[t.chain];
                setParticles(prev => [...prev, ...spawnParticles(nx * cW + cW / 2, ny * cH + cH / 2, pColor, t.type === "golden" ? 18 : 8)]);
              }
              const points = t.type === "golden" ? t.value * 20 : t.value * 10;
              setScore(s => s + points);
              setErgotropy(e => {
                const newE = e + t.value * 3;
                const newM = Math.floor(newE / 50);
                setMilestones(pm => {
                  if (newM > pm) { addEvent(`\u26A1 MILESTONE #${newM} \u2014 +${t.value * 30} SKYNT BONUS`); sfxMilestone(); }
                  return newM;
                });
                const newSM = Math.floor(newE / 500);
                setSuperMilestones(psm => {
                  if (newSM > psm) { addEvent(`\u{1F3C6} SUPER MILESTONE #${newSM} \u2014 OMEGA NFT TRIGGER`); sfxMilestone(); }
                  return newSM;
                });
                return newE;
              });
              setBerryPhase(bp => bp + (2 * Math.PI / 3) * t.value);
              setTreasuresCollected(tc => tc + 1);
              addEvent(`${t.type === "golden" ? "\u2728" : "\u{1F40D}"} Collected ${t.chain} ${t.type === "golden" ? "GOLDEN " : ""}treasure [+${points}]`);
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
            .sort((a, b) => (Math.abs(a.x - head.x) + Math.abs(a.y - head.y)) - (Math.abs(b.x - head.x) + Math.abs(b.y - head.y)))[0];

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

    // Apply screen shake
    ctx.save();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background with subtle gradient
    const bgGrad = ctx.createRadialGradient(rect.width / 2, rect.height / 2, 0, rect.width / 2, rect.height / 2, rect.width * 0.7);
    bgGrad.addColorStop(0, "rgba(5,5,20,0.97)");
    bgGrad.addColorStop(1, "rgba(0,0,0,0.99)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, rect.width + 40, rect.height + 40);

    // Starfield background
    for (const star of starsRef.current) {
      const twinkle = Math.sin(tick * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
      const alpha = star.brightness * (0.3 + twinkle * 0.7);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(star.x * rect.width, star.y * rect.height, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Grid lines with pulsing effect
    const gridPulse = Math.sin(tick * 0.02) * 0.02 + 0.04;
    ctx.strokeStyle = `rgba(0,243,255,${gridPulse})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellW, 0); ctx.lineTo(x * cellW, rect.height); ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellH); ctx.lineTo(rect.width, y * cellH); ctx.stroke();
    }

    // Treasures with enhanced rendering
    for (const t of treasures) {
      const tx = t.x * cellW + cellW / 2;
      const ty = t.y * cellH + cellH / 2;
      const pulse = Math.sin(tick * 0.15) * 0.3 + 0.7;
      const floatY = Math.sin(tick * 0.1 + t.x) * 1.5;
      if (t.type === "skull") {
        ctx.shadowColor = "hsl(0,100%,50%)";
        ctx.shadowBlur = 8 * pulse;
        ctx.fillStyle = "hsl(0,100%,50%)";
        ctx.font = `${Math.min(cellW, cellH) * 0.65}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u2620", tx, ty + floatY);
      } else if (t.type === "golden") {
        // Glowing golden halo
        const haloGrad = ctx.createRadialGradient(tx, ty + floatY, 0, tx, ty + floatY, Math.min(cellW, cellH) * 0.6);
        haloGrad.addColorStop(0, `hsla(50,100%,60%,${0.3 * pulse})`);
        haloGrad.addColorStop(1, "hsla(50,100%,60%,0)");
        ctx.fillStyle = haloGrad;
        ctx.fillRect(tx - cellW, ty + floatY - cellH, cellW * 2, cellH * 2);

        ctx.shadowColor = "hsl(50,100%,60%)";
        ctx.shadowBlur = 12 * pulse;
        ctx.fillStyle = "hsl(50,100%,60%)";
        ctx.beginPath();
        const r = Math.min(cellW, cellH) * 0.35;
        const rotAngle = tick * 0.05;
        for (let i = 0; i < 5; i++) {
          const a = rotAngle - Math.PI / 2 + (i * 2 * Math.PI / 5);
          ctx.lineTo(tx + Math.cos(a) * r, ty + floatY + Math.sin(a) * r);
          const ia = a + Math.PI / 5;
          ctx.lineTo(tx + Math.cos(ia) * r * 0.4, ty + floatY + Math.sin(ia) * r * 0.4);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.shadowColor = CHAIN_COLORS[t.chain];
        ctx.shadowBlur = 8 * pulse;
        ctx.fillStyle = CHAIN_COLORS[t.chain];
        ctx.beginPath();
        const r = Math.min(cellW, cellH) * 0.3;
        const rotAngle = tick * 0.04;
        for (let i = 0; i < 4; i++) {
          const a = rotAngle + (Math.PI / 4) + (i * Math.PI / 2);
          const px = tx + Math.cos(a) * r;
          const py = ty + floatY + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Enhanced snake rendering with glow trail and eyes
    const drawSnake = (snake: Snake, color: string) => {
      // Glow trail behind snake
      for (let i = snake.segments.length - 1; i >= 1; i--) {
        const seg = snake.segments[i];
        const trailAlpha = 0.08 * (1 - i / snake.segments.length);
        ctx.globalAlpha = trailAlpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(seg.x * cellW + cellW / 2, seg.y * cellH + cellH / 2, cellW * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Body segments with rounded corners
      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const alpha = 0.4 + 0.6 * (1 - i / snake.segments.length);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        const pad = i === 0 ? 0.5 : 1.5;
        const rr = Math.min(cellW, cellH) * 0.2;
        const sx = seg.x * cellW + pad;
        const sy = seg.y * cellH + pad;
        const sw = cellW - pad * 2;
        const sh = cellH - pad * 2;
        ctx.beginPath();
        ctx.moveTo(sx + rr, sy);
        ctx.lineTo(sx + sw - rr, sy);
        ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + rr);
        ctx.lineTo(sx + sw, sy + sh - rr);
        ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - rr, sy + sh);
        ctx.lineTo(sx + rr, sy + sh);
        ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - rr);
        ctx.lineTo(sx, sy + rr);
        ctx.quadraticCurveTo(sx, sy, sx + rr, sy);
        ctx.closePath();
        ctx.fill();
        if (i === 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;

      // Eyes on head
      const head = snake.segments[0];
      const cx = head.x * cellW + cellW / 2;
      const cy = head.y * cellH + cellH / 2;
      const dir = snake.direction;
      const eyeR = Math.min(cellW, cellH) * 0.12;
      const eyeOff = Math.min(cellW, cellH) * 0.2;
      // Position eyes perpendicular to direction
      const perpX = -dir.dy;
      const perpY = dir.dx;
      const fwdX = dir.dx * eyeOff * 0.5;
      const fwdY = dir.dy * eyeOff * 0.5;
      const e1x = cx + perpX * eyeOff + fwdX;
      const e1y = cy + perpY * eyeOff + fwdY;
      const e2x = cx - perpX * eyeOff + fwdX;
      const e2y = cy - perpY * eyeOff + fwdY;
      // Eye whites
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();
      // Pupils (look in movement direction)
      ctx.fillStyle = "#111";
      const pupilOff = eyeR * 0.35;
      ctx.beginPath(); ctx.arc(e1x + dir.dx * pupilOff, e1y + dir.dy * pupilOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x + dir.dx * pupilOff, e2y + dir.dy * pupilOff, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
    };

    for (const ai of aiSnakes) {
      if (ai.alive) drawSnake(ai, CHAIN_COLORS[ai.chain as Chain]);
    }
    if (player.alive) drawSnake(player, PLAYER_COLOR);

    // Draw particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.restore();
  }, [player, aiSnakes, treasures, tick, canvasKey, particles, shakeOffset]);

  const skyntReward = (score * 0.1).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="omega-serpent-page" style={{ touchAction: "none" }}>
      {/* TOP HUD BAR */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-black/80 border-b border-neon-green/20 z-20">
        <div className="flex items-center gap-3">
          <span className="font-heading text-sm sm:text-base tracking-widest text-neon-green">OMEGA SERPENT</span>
          <Badge variant="outline" className={`text-[10px] ${gameState === "playing" ? "border-neon-green text-neon-green animate-pulse" : "text-muted-foreground"}`}>
            {gameState === "playing" ? "LIVE" : gameState === "gameover" ? "OVER" : "READY"}
          </Badge>
        </div>
        {gameState === "playing" && (
          <div className="flex items-center gap-3 sm:gap-5 font-mono text-xs">
            <span className="text-neon-cyan" data-testid="text-score">{score}</span>
            <span className="text-neon-green flex items-center gap-1"><Coins className="w-3 h-3" />{skyntReward}</span>
            {combo > 1 && (
              <span className="text-neon-orange flex items-center gap-0.5 animate-pulse" data-testid="combo-display">
                <Zap className="w-3 h-3" />x{combo}
              </span>
            )}
            <span className="text-neon-magenta">{"♥".repeat(lives)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowLeaderboard(!showLeaderboard); setShowRewards(false); }}
            className={`p-1.5 rounded border transition-colors ${showLeaderboard ? "border-neon-orange text-neon-orange bg-neon-orange/10" : "border-white/10 text-white/50 hover:text-white/80"}`}
            data-testid="button-toggle-leaderboard"
          >
            <Crown className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowRewards(!showRewards); setShowLeaderboard(false); }}
            className={`p-1.5 rounded border transition-colors ${showRewards ? "border-neon-green text-neon-green bg-neon-green/10" : "border-white/10 text-white/50 hover:text-white/80"}`}
            data-testid="button-toggle-rewards"
          >
            <Gift className="w-4 h-4" />
          </button>
          <button
            onClick={() => { audioMuted = !audioMuted; setMuted(audioMuted); }}
            className={`p-1.5 rounded border transition-colors ${muted ? "border-red-400 text-red-400 bg-red-400/10" : "border-white/10 text-white/50 hover:text-white/80"}`}
            data-testid="button-toggle-sound"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* GAME CANVAS — fills remaining space */}
      <div className="flex-1 relative overflow-hidden" data-testid="game-arena">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ imageRendering: "pixelated" }} />

        {/* MENU OVERLAY */}
        {gameState === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-10">
            <Gamepad2 className="w-14 h-14 text-neon-green mb-4 animate-pulse" />
            <h2 className="font-heading text-2xl sm:text-3xl text-neon-green tracking-widest mb-2">OMEGA SERPENT v3.0</h2>
            <p className="font-mono text-xs text-muted-foreground mb-6 text-center max-w-sm px-4">
              Control your serpent with WASD, Arrow keys, or the D-pad. Collect treasures to earn SKYNT on-chain.
            </p>
            <div className="flex gap-2 mb-6">
              {CHAINS.map(c => (
                <button
                  key={c}
                  data-testid={`select-chain-${c.toLowerCase()}`}
                  className={`px-4 py-2 rounded-sm font-heading text-sm tracking-wider border transition-all ${selectedChain === c ? "border-neon-green text-neon-green bg-neon-green/10" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
                  onClick={() => setSelectedChain(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <Button
              data-testid="button-start-game"
              className="bg-gradient-to-r from-neon-cyan via-neon-green to-neon-orange text-black font-heading font-bold tracking-widest px-10 py-3 text-base"
              onClick={startGame}
            >
              DEPLOY SERPENT
            </Button>
            <div className="flex items-center gap-5 mt-5 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" />W</span>
              <span className="flex items-center gap-1"><ArrowLeft className="w-3 h-3" />A</span>
              <span className="flex items-center gap-1"><ArrowDown className="w-3 h-3" />S</span>
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3" />D</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/50 mt-3">Touch D-pad available during gameplay</p>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-10">
            <Skull className="w-12 h-12 text-red-500 mb-3" />
            <h2 className="font-heading text-2xl text-red-400 tracking-widest mb-2">GAME OVER</h2>
            <div className="text-center space-y-1.5 mb-6">
              <p className="font-mono text-2xl text-neon-green">SCORE: {score}</p>
              <p className="font-mono text-lg text-neon-cyan flex items-center justify-center gap-1"><Coins className="w-5 h-5" /> {skyntReward} SKYNT</p>
              <p className="font-mono text-xs text-muted-foreground">Ergotropy: {Math.floor(ergotropy)} | Milestones: {milestones} | Treasures: {treasuresCollected}</p>
            </div>
            <div className="flex gap-3">
              <Button
                data-testid="button-play-again"
                className="bg-gradient-to-r from-neon-cyan via-neon-green to-neon-orange text-black font-heading font-bold tracking-widest px-8 py-3"
                onClick={startGame}
              >
                PLAY AGAIN
              </Button>
              <Button
                variant="outline"
                className="border-neon-green/40 text-neon-green font-heading tracking-widest px-6 py-3"
                onClick={() => setShowRewards(true)}
                data-testid="button-view-rewards"
              >
                CLAIM REWARDS
              </Button>
            </div>
          </div>
        )}

        {/* D-PAD — anchored bottom-right during gameplay */}
        {gameState === "playing" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 opacity-80 hover:opacity-100 transition-opacity" data-testid="dpad-container">
            <DPad onDir={handleDpadDir} />
          </div>
        )}

        {/* COMBO INDICATOR — top-right during gameplay */}
        {gameState === "playing" && combo > 1 && (
          <div className="absolute top-10 right-4 z-20 pointer-events-none" data-testid="combo-indicator">
            <div className={`font-heading text-2xl sm:text-3xl tracking-widest ${combo >= 5 ? "text-neon-orange" : combo >= 3 ? "text-neon-cyan" : "text-neon-green"} animate-pulse drop-shadow-[0_0_12px_currentColor]`}>
              {combo}x COMBO
            </div>
          </div>
        )}

        {/* LIVE EVENT TICKER — bottom-left during gameplay */}
        {gameState === "playing" && eventLog.length > 0 && (
          <div className="absolute bottom-4 left-3 z-20 max-w-[260px] sm:max-w-[340px]">
            <div className="bg-black/70 border border-white/10 rounded px-2.5 py-1.5 space-y-0.5 font-mono text-[10px]" data-testid="game-event-feed">
              {eventLog.slice(0, 4).map((msg, i) => (
                <p key={i} className={`${i === 0 ? "text-neon-green" : "text-white/40"} truncate`}>{">"} {msg}</p>
              ))}
            </div>
          </div>
        )}

        {/* ERGOTROPY BAR — top of game area during play */}
        {gameState === "playing" && (
          <div className="absolute top-0 left-0 right-0 z-20 px-3 py-1 bg-black/50">
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-orange transition-all"
                style={{ width: `${(ergotropy % 500) / 5}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-white/30 mt-0.5">
              <span>ERG {Math.floor(ergotropy)}</span>
              <span>NEXT SUPER {(superMilestones + 1) * 500}</span>
            </div>
          </div>
        )}
      </div>

      {/* LEADERBOARD SLIDE-OVER */}
      {showLeaderboard && (
        <div className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-black/95 border-l border-neon-orange/30 z-30 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neon-orange/20">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-neon-orange" />
              <span className="font-heading text-sm tracking-widest text-neon-orange">LEADERBOARD</span>
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5" data-testid="leaderboard">
            {leaderboard && leaderboard.length > 0 ? leaderboard.slice(0, 15).map((entry: any, i: number) => (
              <div key={entry.id} className={`flex items-center justify-between p-2 rounded ${i === 0 ? "bg-neon-orange/10 border border-neon-orange/30" : i < 3 ? "bg-white/5 border border-white/10" : "border border-transparent"}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-heading text-xs w-6 text-center ${i === 0 ? "text-neon-orange" : i < 3 ? "text-neon-cyan" : "text-muted-foreground"}`}>
                    {i === 0 ? "\u{1F451}" : `#${i + 1}`}
                  </span>
                  <span className="font-mono text-xs text-foreground truncate max-w-[90px]">{entry.username}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-neon-green">{entry.score}</span>
                  <span className="font-mono text-[9px] text-muted-foreground ml-1">({entry.chain})</span>
                </div>
              </div>
            )) : (
              <p className="font-mono text-xs text-muted-foreground/50 text-center py-8">No scores yet. Be the first!</p>
            )}
          </div>
        </div>
      )}

      {/* REWARDS SLIDE-OVER */}
      {showRewards && (
        <div className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-black/95 border-l border-neon-green/30 z-30 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neon-green/20">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-neon-green" />
              <span className="font-heading text-sm tracking-widest text-neon-green">MY REWARDS</span>
            </div>
            <button onClick={() => setShowRewards(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="my-rewards">
            {myScores && myScores.length > 0 ? myScores.slice(0, 10).map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded">
                <div>
                  <div className="font-mono text-xs text-foreground flex items-center gap-1"><Trophy className="w-3 h-3 text-neon-orange" /> {entry.score} pts</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{entry.chain} | {parseFloat(entry.skyntEarned).toFixed(2)} SKYNT</div>
                </div>
                {entry.claimed ? (
                  <Badge variant="outline" className="text-[9px] border-neon-green/30 text-neon-green">CLAIMED</Badge>
                ) : (
                  <Button
                    size="sm"
                    data-testid={`button-claim-${entry.id}`}
                    className="text-[10px] h-7 px-3 bg-neon-green/20 border border-neon-green/40 text-neon-green hover:bg-neon-green/30"
                    onClick={() => claimMutation.mutate(entry.id)}
                    disabled={claimMutation.isPending}
                  >
                    CLAIM
                  </Button>
                )}
              </div>
            )) : (
              <p className="font-mono text-xs text-muted-foreground/50 text-center py-8">Play to earn rewards!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
