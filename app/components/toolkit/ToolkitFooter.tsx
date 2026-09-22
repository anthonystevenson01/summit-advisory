import Image from "next/image";
import Link from "next/link";

/**
 * Shared footer used across /tools and /tools/[tool] routes.
 * Keeps the GTM Tools link dimmed to mark the current section.
 */
export default function ToolkitFooter() {
  return (
    <footer className="footer">
      <Image
        src="/brand-icons/Combination Mark_White.png"
        alt="Summit"
        width={140}
        height={22}
        className="footer-logo"
      />
      <ul className="footer-links">
        <li><Link href="/">Home</Link></li>
        <li><Link href="/ai-studio">AI Studio</Link></li>
        <li><Link href="/scale-up-advisory">Scale-Up Advisory</Link></li>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- homepage SPA reads ?page= from window.location once on mount; full document load is intentional */}
        <li><a href="/?page=resources">Resources</a></li>
        <li><Link href="/tools" style={{ color: "rgba(255,255,255,0.55)" }}>GTM Tools</Link></li>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- homepage SPA reads ?page= from window.location once on mount; full document load is intentional */}
        <li><a href="/?page=blog">Blog</a></li>
        <li><Link href="/newsletter">Newsletter</Link></li>
      </ul>
      <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
    </footer>
  );
}
