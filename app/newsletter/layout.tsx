import { ReactNode } from "react";

export default function NewsletterLayout({ children }: { children: ReactNode }) {
  return <div className="toolkit">{children}</div>;
}
