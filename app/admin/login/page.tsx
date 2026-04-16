"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/app/lib/brand";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginInner />
    </Suspense>
  );
}

function AdminLoginInner() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((data: { adminExists?: boolean }) => setIsSetup(!data.adminExists))
      .catch(() => setIsSetup(false));
  }, []);

  const displayError = error || urlError || "";

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      await fetch("/api/admin/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetSent(true);
    } catch {
      setResetSent(true); // Always show success to avoid leaking info
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (res.ok && data.token) {
        // Redirect to activate endpoint which sets the cookie via GET redirect
        window.location.href = `/api/admin/activate?token=${data.token}`;
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (res.ok && data.token) {
        // Redirect to activate endpoint which sets the cookie via GET redirect
        window.location.href = `/api/admin/activate?token=${data.token}`;
      } else {
        setError(data.error || "Setup failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)` }}>
        <p style={{ color: BRAND.white, fontSize: 14, fontFamily: "var(--font-dm-sans), sans-serif" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`,
        fontFamily: "var(--font-dm-sans), sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          background: BRAND.white,
          borderRadius: 12,
          padding: "40px 36px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-oswald), sans-serif",
            fontSize: 24,
            fontWeight: 600,
            color: BRAND.darkGreen,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          {isSetup ? "Create Admin Account" : "Admin Console"}
        </h1>
        <p style={{ fontSize: 13, color: BRAND.mid, textAlign: "center", margin: "0 0 28px" }}>
          {isSetup ? "Set up your password to get started" : "Summit Strategy Advisory"}
        </p>

        {displayError && (
          <div
            style={{
              background: "#FFEBEE",
              border: `1px solid ${BRAND.red}30`,
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 20,
              fontSize: 13,
              color: BRAND.red,
            }}
          >
            {displayError}
          </div>
        )}

        {isSetup ? (
          <form onSubmit={handleSetup}>
            <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password (min 8 characters)"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BRAND.border}`,
                fontSize: 14,
                fontFamily: "var(--font-dm-sans), sans-serif",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: 12,
              }}
            />
            <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BRAND.border}`,
                fontSize: 14,
                fontFamily: "var(--font-dm-sans), sans-serif",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: 16,
              }}
            />
            <button
              type="submit"
              disabled={!password || !confirmPassword || loading}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 6,
                border: "none",
                background: !password || !confirmPassword ? BRAND.border : BRAND.brandGreen,
                color: BRAND.white,
                fontFamily: "var(--font-oswald), sans-serif",
                fontWeight: 600,
                fontSize: 15,
                cursor: !password || !confirmPassword ? "not-allowed" : "pointer",
                letterSpacing: "0.03em",
              }}
            >
              {loading ? "Setting up..." : "Create Account"}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleLogin}>
              <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${BRAND.border}`,
                  fontSize: 14,
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  boxSizing: "border-box",
                  outline: "none",
                  marginBottom: 16,
                }}
              />
              <button
                type="submit"
                disabled={!password || loading}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 6,
                  border: "none",
                  background: !password ? BRAND.border : BRAND.brandGreen,
                  color: BRAND.white,
                  fontFamily: "var(--font-oswald), sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: !password ? "not-allowed" : "pointer",
                  letterSpacing: "0.03em",
                }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Forgot password */}
            {!showReset ? (
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: BRAND.mid }}>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  style={{ background: "none", border: "none", color: BRAND.teal, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}
                >
                  Forgot password?
                </button>
              </p>
            ) : resetSent ? (
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 6, fontSize: 13, color: "#2E7D32", textAlign: "center" }}>
                If that email matches the admin account, a reset link has been sent.
              </div>
            ) : (
              <form onSubmit={handleResetRequest} style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: BRAND.border }} />
                  <span style={{ fontSize: 11, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.08em" }}>Reset</span>
                  <div style={{ flex: 1, height: 1, background: BRAND.border }} />
                </div>
                <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>Your email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your admin email"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${BRAND.border}`, fontSize: 14, fontFamily: "var(--font-dm-sans), sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    style={{ flex: 1, padding: "10px", borderRadius: 6, border: `1px solid ${BRAND.border}`, background: BRAND.white, color: BRAND.mid, fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 14, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!resetEmail || resetLoading}
                    style={{ flex: 2, padding: "10px", borderRadius: 6, border: "none", background: !resetEmail ? BRAND.border : BRAND.teal, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 14, cursor: !resetEmail ? "not-allowed" : "pointer", letterSpacing: "0.03em" }}
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: 1, background: BRAND.border }} />
              <span style={{ fontSize: 11, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
              <div style={{ flex: 1, height: 1, background: BRAND.border }} />
            </div>

            <a
              href="/api/admin/google"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "10px",
                borderRadius: 6,
                border: `1px solid ${BRAND.border}`,
                background: BRAND.white,
                color: BRAND.darkGreen,
                fontFamily: "var(--font-dm-sans), sans-serif",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Sign in with Google
            </a>
          </>
        )}
      </div>
    </div>
  );
}
