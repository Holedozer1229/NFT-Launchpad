import { useMemo } from "react";
import { useLocation } from "wouter";

const ROUTE_THEMES: Record<string, string> = {
  "/": "bg-theme-mint",
  "/dashboard": "bg-theme-dashboard",
  "/gallery": "bg-theme-gallery",
  "/marketplace": "bg-theme-marketplace",
  "/analytics": "bg-theme-analytics",
  "/bridge": "bg-theme-bridge",
  "/yield": "bg-theme-yield",
  "/iit": "bg-theme-iit",
  "/serpent": "bg-theme-serpent",
  "/wallet": "bg-theme-wallet",
  "/admin": "bg-theme-admin",
};

const ROUTE_COLORS: Record<string, [string, string, string]> = {
  "/": ["hsl(185 100% 50%)", "hsl(145 100% 50%)", "hsl(210 100% 55%)"],
  "/dashboard": ["hsl(210 100% 55%)", "hsl(185 100% 50%)", "hsl(145 100% 50%)"],
  "/gallery": ["hsl(280 100% 60%)", "hsl(300 100% 60%)", "hsl(210 100% 55%)"],
  "/marketplace": ["hsl(45 100% 50%)", "hsl(30 100% 55%)", "hsl(300 100% 60%)"],
  "/analytics": ["hsl(210 100% 55%)", "hsl(300 100% 60%)", "hsl(145 100% 50%)"],
  "/bridge": ["hsl(30 100% 55%)", "hsl(185 100% 50%)", "hsl(300 100% 60%)"],
  "/yield": ["hsl(145 100% 50%)", "hsl(185 100% 50%)", "hsl(45 100% 50%)"],
  "/iit": ["hsl(280 100% 60%)", "hsl(185 100% 50%)", "hsl(300 100% 60%)"],
  "/serpent": ["hsl(145 100% 50%)", "hsl(0 100% 60%)", "hsl(280 100% 60%)"],
  "/wallet": ["hsl(185 100% 50%)", "hsl(45 100% 50%)", "hsl(145 100% 50%)"],
  "/admin": ["hsl(0 100% 60%)", "hsl(30 100% 55%)", "hsl(210 100% 55%)"],
};

interface NebulaConfig {
  x: string;
  y: string;
  size: string;
  delay: string;
  duration: string;
}

export default function DynamicBackground() {
  const [location] = useLocation();

  const themeClass = ROUTE_THEMES[location] || "bg-theme-mint";
  const colors = ROUTE_COLORS[location] || ROUTE_COLORS["/"];

  const nebulae = useMemo<NebulaConfig[]>(() => {
    return [
      { x: "15%", y: "20%", size: "400px", delay: "0s", duration: "18s" },
      { x: "70%", y: "60%", size: "350px", delay: "3s", duration: "22s" },
      { x: "40%", y: "80%", size: "300px", delay: "7s", duration: "25s" },
      { x: "85%", y: "15%", size: "250px", delay: "5s", duration: "20s" },
      { x: "25%", y: "55%", size: "200px", delay: "10s", duration: "28s" },
    ];
  }, []);

  return (
    <div className={`dynamic-bg ${themeClass}`} data-testid="dynamic-background">
      {nebulae.map((n, i) => (
        <div
          key={`${location}-${i}`}
          className="dynamic-bg-nebula"
          style={{
            left: n.x,
            top: n.y,
            width: n.size,
            height: n.size,
            background: `radial-gradient(circle, ${colors[i % 3]} 0%, transparent 70%)`,
            animationDelay: n.delay,
            animationDuration: n.duration,
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, ${colors[0].replace(")", " / 0.06)")}, transparent 60%),
            radial-gradient(ellipse at 80% 20%, ${colors[1].replace(")", " / 0.05)")}, transparent 50%),
            radial-gradient(ellipse at 50% 80%, ${colors[2].replace(")", " / 0.04)")}, transparent 50%)
          `,
        }}
      />
    </div>
  );
}
