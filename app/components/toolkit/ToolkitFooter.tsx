import Image from "next/image";

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
        <li><a href="/">Home</a></li>
        <li><a href="/">AI Studio</a></li>
        <li><a href="/">Scale-Up Advisory</a></li>
        <li><a href="/">Resources</a></li>
        <li><a href="/tools" style={{ color: "rgba(255,255,255,0.55)" }}>GTM Tools</a></li>
        <li><a href="/">Blog</a></li>
        <li><a href="/newsletter">Newsletter</a></li>
      </ul>
      <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
    </footer>
  );
}
