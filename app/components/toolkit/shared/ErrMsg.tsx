"use client";

interface ErrMsgProps {
  msg: string;
  retry: () => void;
  dark: boolean;
}

export default function ErrMsg({ msg, retry, dark }: ErrMsgProps) {
  const fg = dark ? "#fff" : "#053030";
  const btnBg = dark ? "rgba(255,255,255,0.1)" : "rgba(5,48,48,0.08)";
  return (
    <div className="tk-err-wrap" style={{ color: fg }}>
      <p className="tk-err-msg">{msg}</p>
      <button
        onClick={retry}
        className="tk-btn-ghost"
        style={{ color: fg, borderColor: fg + "66" , background: btnBg }}
        aria-label="Retry analysis"
      >
        Try Again
      </button>
    </div>
  );
}
