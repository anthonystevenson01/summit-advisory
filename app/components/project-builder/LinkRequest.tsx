"use client";

import { useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { EMAIL_REGEX } from "@/app/lib/tools/validate";
import { LINK_REQUEST } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS, btnAlt, btnDisabled, field, status } from "./builder-styles";

export interface LinkRequestProps {
  onSubmit: (email: string) => Promise<void>;
  /** The fixed answer line once a request has gone. */
  answer: string;
}

/** "Email me my link" on the start screen: one address field, the button, the fixed answer line. */
export default function LinkRequest({ onSubmit, answer }: LinkRequestProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = EMAIL_REGEX.test(email.trim());
  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(email.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <section style={{ borderTop: `2px solid ${BRAND.border}`, marginTop: 34, paddingTop: 22 }}>
      <h2 style={{ fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 24, margin: "0 0 4px" }}>{LINK_REQUEST.title}</h2>
      <p style={{ margin: "0 0 12px", fontFamily: SANS, fontSize: 15, color: BRAND.teal }}>{LINK_REQUEST.lede}</p>
      <div className="pb-adder-2" style={{ maxWidth: 520 }}>
        <input
          type="email"
          name="resumeEmail"
          aria-label={LINK_REQUEST.button}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={LINK_REQUEST.placeholder}
          autoComplete="email"
          style={field}
        />
        <button type="button" onClick={() => void send()} disabled={!valid || busy} style={{ ...btnAlt, ...(!valid || busy ? btnDisabled : {}) }}>
          {LINK_REQUEST.button}
        </button>
      </div>
      <p style={status} role="status">{answer}</p>
    </section>
  );
}
