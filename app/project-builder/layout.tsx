import { ReactNode } from "react";

/**
 * Under /tools the builder inherited the .toolkit wrapper from
 * app/tools/layout.tsx. Moving it out lost that, so this layout puts it back:
 * .toolkit in globals.css sets the off-white background, the full viewport
 * height, the serif fallback and the --tk-* colour variables, and without it
 * the page would not look as it did under /tools.
 */
export default function ProjectBuilderLayout({ children }: { children: ReactNode }) {
  return <div className="toolkit">{children}</div>;
}
