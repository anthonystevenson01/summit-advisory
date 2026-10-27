import { ReactNode } from "react";

export default function ProjectBuilderLayout({ children }: { children: ReactNode }) {
  return <div className="toolkit">{children}</div>;
}
