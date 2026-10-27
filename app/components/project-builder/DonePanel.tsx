"use client";

import type { ReactNode } from "react";
import { BRAND } from "@/app/lib/brand";
import { CONFIRMATION_LINE, DONE } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS } from "./builder-styles";

export interface DonePanelProps {
  firstName: string;
  children?: ReactNode;
}

/** The confirmation heading and the two working days line, shown right after a submit above the read only view. */
export default function DonePanel({ firstName, children }: DonePanelProps) {
  return (
    <div style={{ maxWidth: 760, padding: "10px 0 20px" }}>
      <h2 style={{ fontFamily: CONDENSED, fontWeight: 700, color: BRAND.darkGreen, fontSize: "clamp(32px, 4.6vw, 52px)", lineHeight: 1.05, margin: "0 0 12px" }}>
        {DONE.title(firstName)}
      </h2>
      <p style={{ fontSize: 19, maxWidth: "58ch", fontFamily: SANS, color: BRAND.teal, lineHeight: 1.5, margin: 0 }}>{CONFIRMATION_LINE}</p>
      {children}
    </div>
  );
}
