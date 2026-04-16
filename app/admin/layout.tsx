import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "var(--font-dm-sans), sans-serif", background: "#F5F7F6" }}>
      <nav
        style={{
          background: "#053030",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 16, color: "#fff" }}>
            Summit Admin
          </span>
          <a href="/admin" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>
            Dashboard
          </a>
          <a href="/admin/ai-studio" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>
            AI Studio
          </a>
          <a href="/admin/icp" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)", textDecoration: "none" }}>
            ICP Submissions
          </a>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 4,
              padding: "5px 14px",
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}
          >
            Logout
          </button>
        </form>
      </nav>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>{children}</main>
    </div>
  );
}
