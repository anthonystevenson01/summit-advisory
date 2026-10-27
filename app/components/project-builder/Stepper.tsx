"use client";

import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import { STEPS } from "@/app/lib/project-builder/catalogue";
import { STEPPER } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS, TINT } from "./builder-styles";

export interface StepperProps {
  step: number;
  onGo: (step: number) => void;
}

const arrow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: `2px solid ${BRAND.darkGreen}`,
  background: "transparent",
  color: BRAND.darkGreen,
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  marginTop: 2,
  fontFamily: SANS,
  fontSize: 15,
};

/**
 * The rail: Back, the six step buttons (done steps green, the current one
 * marked, any step reopenable), Next, and the "Step n of 6" line that
 * replaces the labels under 700 px.
 */
export default function Stepper({ step, onGo }: StepperProps) {
  const n = STEPS.length;
  const last = step === n - 1;
  const first = step === 0;
  return (
    <nav
      className="pb-rail"
      aria-label="Progress through the steps"
      style={{ background: BRAND.white, borderBottom: `2px solid ${BRAND.border}` }}
    >
      <button
        type="button"
        onClick={() => onGo(Math.max(step - 1, 0))}
        style={{ ...arrow, visibility: first ? "hidden" : "visible" }}
        tabIndex={first ? -1 : 0}
        aria-hidden={first}
        aria-label={first ? undefined : STEPPER.backTo(STEPS[step - 1])}
      >
        <span aria-hidden="true">&larr;</span>
        <span className="pb-arrow-t">{STEPPER.back}</span>
      </button>
      <ol
        className="pb-steps"
        style={{ "--p": (step / (n - 1)).toFixed(3), "--pb-line": BRAND.border, "--pb-accent": BRAND.brandGreen } as CSSProperties}
      >
        {STEPS.map((name, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={name}>
              <button
                type="button"
                className="pb-step-btn"
                onClick={() => onGo(i)}
                aria-current={current ? "step" : undefined}
                aria-label={STEPPER.stepLabel(i + 1, name)}
                style={{ color: current ? BRAND.darkGreen : BRAND.teal, fontWeight: current ? 700 : 400, fontFamily: SANS }}
              >
                <span
                  className="pb-step-dot"
                  aria-hidden="true"
                  style={{
                    fontFamily: CONDENSED,
                    fontWeight: 600,
                    fontSize: 16,
                    border: `2px solid ${done || current ? (done ? BRAND.brandGreen : BRAND.darkGreen) : BRAND.border}`,
                    background: done ? BRAND.brandGreen : current ? BRAND.darkGreen : BRAND.white,
                    color: done || current ? BRAND.white : BRAND.teal,
                    boxShadow: current ? `0 0 0 4px ${TINT}` : "none",
                  }}
                >
                  {i + 1}
                </span>
                <span className="pb-step-lbl" aria-hidden="true">{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => onGo(Math.min(step + 1, n - 1))}
        style={{ ...arrow, background: BRAND.darkGreen, color: BRAND.white, visibility: last ? "hidden" : "visible" }}
        tabIndex={last ? -1 : 0}
        aria-hidden={last}
        aria-label={last ? undefined : STEPPER.nextTo(STEPS[step + 1])}
      >
        <span className="pb-arrow-t">{STEPPER.next}</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
      <p className="pb-now" style={{ color: BRAND.darkGreen, fontFamily: SANS }}>{STEPPER.stepOf(step + 1, n, STEPS[step])}</p>
    </nav>
  );
}
