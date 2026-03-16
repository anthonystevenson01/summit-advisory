"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const BRAND = {
  darkGreen: "#053030",
  teal: "#005A66",
  brandGreen: "#319A65",
  white: "#FFFFFF",
  mid: "#666666",
  border: "#D0D5D2",
  red: "#C0392B",
};

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
  const [clientError, setClientError] = useState("");
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const serverError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((data: { adminExists?: boolean }) => setIsSetup(!data.adminExists))
      .catch(() => setIsSetup(false));
  }, []);

  const error = clientError || serverError || "";

  // Client-side validation before form submit for setup
  const handleSetupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError("");
    if (password.length < 8) {
      e.preventDefault();
      setClientError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      e.preventDefault();
      setClientError("Passwords don't match");
      return;
    }
    // Let the form submit natively
  };

  if (isSetup === null) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)` }}>
        <p style={{ color: BRAND.white, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
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
        fontFamily: "'DM Sans', sans-serif",
        padding: 24,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
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
            fontFamily: "'Oswald', sans-serif",
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

        {error && (
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
            {error}
          </div>
        )}

        {isSetup ? (
          /* Native form POST — browser handles the redirect + cookie */
          <form method="POST" action="/api/admin/setup" onSubmit={handleSetupSubmit}>
            <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password (min 8 characters)"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BRAND.border}`,
                fontSize: 14,
                fontFamily: "'DM Sans', sans-serif",
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
                fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
                outline: "none",
                marginBottom: 16,
              }}
            />
            <button
              type="submit"
              disabled={!password || !confirmPassword}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 6,
                border: "none",
                background: !password || !confirmPassword ? BRAND.border : BRAND.brandGreen,
                color: BRAND.white,
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                cursor: !password || !confirmPassword ? "not-allowed" : "pointer",
                letterSpacing: "0.03em",
              }}
            >
              Create Account
            </button>
          </form>
        ) : (
          <>
            {/* Native form POST — browser handles the redirect + cookie */}
            <form method="POST" action="/api/admin/login">
              <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${BRAND.border}`,
                  fontSize: 14,
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: "border-box",
                  outline: "none",
                  marginBottom: 16,
                }}
              />
              <button
                type="submit"
                disabled={!password}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 6,
                  border: "none",
                  background: !password ? BRAND.border : BRAND.brandGreen,
                  color: BRAND.white,
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: !password ? "not-allowed" : "pointer",
                  letterSpacing: "0.03em",
                }}
              >
                Sign In
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "24px 0",
              }}
            >
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
                fontFamily: "'DM Sans', sans-serif",
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
