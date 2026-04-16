import { ReactNode } from "react";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <div className="toolkit">{children}</div>;
}
