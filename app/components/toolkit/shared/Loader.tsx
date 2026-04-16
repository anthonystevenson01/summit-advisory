"use client";

interface LoaderProps {
  dark: boolean;
  label: string;
  sub?: string;
}

export default function Loader({ dark, label, sub }: LoaderProps) {
  const fg = dark ? "#fff" : "#053030";
  return (
    <div className="tk-loader-wrap" style={{ color: fg }}>
      <div className="tk-spinner" style={{ borderTopColor: fg }} />
      <div className="tk-loader-label">{label}</div>
      {sub && <div className="tk-loader-sub">{sub}</div>}
    </div>
  );
}
