"use client";

import { useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { EMAIL_REGEX } from "@/app/lib/tools/validate";

const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  fontSize: 14,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: BRAND.dark,
  background: BRAND.white,
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s",
};

export interface UnlockGateProps {
  /** Prefixes the three field ids: `{prefix}-unlock-{key}`. */
  idPrefix: string;
  onSubmit: (email: string, name: string, company: string) => void;
  busy?: boolean;
}

/**
 * The 1b unlock gate, shared by every tool page and the Built to Scale?
 * page: email required, name and company optional, the button enabled when
 * the email is valid. Owns its three field states and hands the trimmed
 * trio to the owner on submit.
 */
export default function UnlockGate({ idPrefix, onSubmit, busy = false }: UnlockGateProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const emailValid = EMAIL_REGEX.test(email.trim());
  const canSubmit = emailValid && !busy;

  return (
    <div style={{ background: BRAND.white, borderRadius: 8, padding: 24, border: `1px solid ${BRAND.teal}30` }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${BRAND.teal}15`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 6px" }}>Unlock the full view</h3>
        <p style={{ fontSize: 13, color: BRAND.mid, margin: 0 }}>We use your email to send you this result and to unlock every tool for 30 days. Nothing else.</p>
      </div>
      {[
        { key: "email", label: "Email", value: email, set: setEmail, placeholder: "you@company.com", type: "email", required: true },
        { key: "name", label: "Name (optional)", value: name, set: setName, placeholder: "Your name", type: "text", required: false },
        { key: "company", label: "Company (optional)", value: company, set: setCompany, placeholder: "Your company", type: "text", required: false },
      ].map((f) => (
        <div key={f.key} style={{ marginBottom: 12 }}>
          <label htmlFor={`${idPrefix}-unlock-${f.key}`} style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 4 }}>{f.label}</label>
          <input
            id={`${idPrefix}-unlock-${f.key}`}
            type={f.type}
            value={f.value}
            required={f.required}
            onChange={(e) => f.set(e.target.value)}
            placeholder={f.placeholder}
            style={fieldStyle}
            onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
            onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => canSubmit && onSubmit(email.trim(), name.trim(), company.trim())}
        disabled={!canSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 6, border: "none", background: canSubmit ? BRAND.brandGreen : BRAND.border, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: "0.04em", marginTop: 8, cursor: canSubmit ? "pointer" : "not-allowed" }}
      >
        Unlock and email my result
      </button>
      <p style={{ fontSize: 11, color: BRAND.mid, textAlign: "center", marginTop: 10, marginBottom: 0 }}>
        Your result arrives by email with a saved link and a delete-my-data link. No spam, no third-party sharing.{" "}
        <a href="mailto:privacy@summitstrategyadvisory.com" style={{ color: BRAND.teal, textDecoration: "none" }}>privacy@summitstrategyadvisory.com</a>.
      </p>
    </div>
  );
}
