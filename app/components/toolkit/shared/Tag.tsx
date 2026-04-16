"use client";

import { ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  color: string;
}

export default function Tag({ children, color }: TagProps) {
  return (
    <span
      className="tk-pill"
      style={{
        background: color + "22",
        color: color,
        border: `1px solid ${color}44`,
      }}
    >
      {children}
    </span>
  );
}
