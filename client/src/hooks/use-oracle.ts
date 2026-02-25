import { useEffect, useState } from "react";

export interface OracleVector {
  x: number;
  y: number;
  strength: number;
  type: "danger" | "reward";
}

export function useOracle() {
  const [oracleVectors, setVectors] = useState<OracleVector[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/oracle");
        const data = await res.json();
        setVectors(data);
      } catch (error) {
        console.error("Failed to fetch oracle vectors:", error);
      }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  return { oracleVectors };
}
