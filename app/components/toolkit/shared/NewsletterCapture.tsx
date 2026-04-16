"use client";

import { useState } from "react";

interface NewsletterCaptureProps {
  dark: boolean;
  label?: string;
}

export default function NewsletterCapture({ dark, label }: NewsletterCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "coming_soon" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const fg = dark ? "#fff" : "#053030";
  const bg = dark ? "#005A66" : "#D6EDE3";
  const inputBg = dark ? "rgba(255,255,255,0.1)" : "#fff";
  const inputColor = dark ? "#fff" : "#053030";
  const btnBg = dark ? "#319A65" : "#053030";
  const btnFg = "#fff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      if (data.status === "coming_soon") {
        setStatus("coming_soon");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="tk-nl-capture" style={{ background: bg, color: fg }}>
      <div className="tk-nl-title" style={{ color: fg }}>
        {label ?? "The Scale-Up Letter"}
      </div>
      <p className="tk-nl-sub">
        Practical GTM thinking for teams selling into finite markets. No filler. No hype.
      </p>

      {status === "success" && (
        <p className="tk-nl-success">You&rsquo;re in. Look out for the next issue.</p>
      )}
      {status === "coming_soon" && (
        <p className="tk-nl-success">
          We&rsquo;re not live yet — but you&rsquo;ll be among the first to know.
        </p>
      )}
      {(status === "idle" || status === "loading" || status === "error") && (
        <form onSubmit={handleSubmit}>
          <div className="tk-nl-row">
            <label htmlFor="nl-capture-email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
              Email address
            </label>
            <input
              id="nl-capture-email"
              className="tk-nl-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{ background: inputBg, color: inputColor, border: "none" }}
              aria-label="Email address for newsletter"
            />
            <button
              type="submit"
              className="tk-nl-btn"
              disabled={status === "loading"}
              style={{ background: btnBg, color: btnFg }}
            >
              {status === "loading" ? "..." : "Subscribe"}
            </button>
          </div>
          {status === "error" && (
            <p style={{ fontSize: 13, marginTop: 8, color: "#ef4444" }}>{errorMsg}</p>
          )}
        </form>
      )}
    </div>
  );
}
