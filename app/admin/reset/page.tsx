"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/app/lib/brand";

export default function ResetPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (res.ok && data.token) {
        window.location.href = `/api/admin/activate?token=${data.token}`;
      } else {
        setError(data.error || "Reset failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, fontFamily: "var(--font-dm-sans), sans-serif" }}>
        <div style={{ background: BRAND.white, borderRadius: 12, padding: "40px 36px", maxWidth: 380, width: "100%", textAlign: "center" }}>
          <p style={{ color: BRAND.red, fontSize: 14 }}>Invalid reset link. <a href="/admin/login" style={{ color: BRAND.teal }}>Back to login</a></p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, fontFamily: "var(--font-dm-sans), sans-serif", padding: 24 }}>
      <div style={{ background: BRAND.white, borderRadius: 12, padding: "40px 36px", maxWidth: 380, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 24, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 8px", textAlign: "center" }}>
          Set New Password
        </h1>
        <p style={{ fontSize: 13, color: BRAND.mid, textAlign: "center", margin: "0 0 28px" }}>
          Summit Strategy Advisory
        </p>

        {error && (
          <div style={{ background: "#FFEBEE", border: `1px solid ${BRAND.red}30`, borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: BRAND.red }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${BRAND.border}`, fontSize: 14, fontFamily: "var(--font-dm-sans), sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 12 }}
          />
          <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm your password"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${BRAND.border}`, fontSize: 14, fontFamily: "var(--font-dm-sans), sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 16 }}
          />
          <button
            type="submit"
            disabled={!password || !confirm || loading}
            style={{ width: "100%", padding: "11px", borderRadius: 6, border: "none", background: !password || !confirm ? BRAND.border : BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 15, cursor: !password || !confirm ? "not-allowed" : "pointer", letterSpacing: "0.03em" }}
          >
            {loading ? "Saving..." : "Set New Password"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: BRAND.mid }}>
          <a href="/admin/login" style={{ color: BRAND.teal, textDecoration: "none" }}>Back to login</a>
        </p>
      </div>
    </div>
  );
}
