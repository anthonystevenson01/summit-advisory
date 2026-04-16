"use client";

import { useEffect, useState } from "react";

interface CyclingLoaderProps {
  dark: boolean;
  messages: string[];
}

export default function CyclingLoader({ dark, messages }: CyclingLoaderProps) {
  const [index, setIndex] = useState(0);
  const fg = dark ? "#fff" : "#053030";

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 2800);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="tk-loader-wrap" style={{ color: fg }}>
      <div className="tk-spinner" style={{ borderTopColor: fg }} />
      <div className="tk-loader-label">{messages[index]}</div>
    </div>
  );
}
