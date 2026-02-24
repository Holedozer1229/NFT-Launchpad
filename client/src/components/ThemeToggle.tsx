import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "skynt-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as "dark" | "light" | null;
    const initial = saved || "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      data-testid="button-theme-toggle"
      className="p-2 rounded-sm text-muted-foreground hover:text-foreground transition-colors border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:shadow-[0_0_10px_hsl(185_100%_50%/0.15)]"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
