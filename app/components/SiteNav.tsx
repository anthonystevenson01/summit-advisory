"use client";

const LOGO_WHITE = "/brand-icons/Combination Mark_White.png";
const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

interface SiteNavProps {
  /** Highlight one of the nav items as the current page */
  activePage?: "resources" | "tools" | "blog" | "careers" | "newsletter";
  /** SPA override handlers — used on the main homepage */
  onLogoClick?: () => void;
  onResources?: () => void;
  onBlog?: () => void;
  onCareers?: () => void;
  onBookCall?: () => void;
}

export default function SiteNav({
  activePage,
  onLogoClick,
  onResources,
  onBlog,
  onCareers,
  onBookCall,
}: SiteNavProps) {
  const activeStyle = { color: "rgba(255,255,255,0.9)", cursor: "default" };

  return (
    <nav className="nav">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_WHITE}
        alt="Summit Strategy Advisory"
        className="nav-logo"
        onClick={onLogoClick ?? (() => { window.location.href = "/"; })}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && (onLogoClick ? onLogoClick() : (window.location.href = "/"))}
      />
      <div className="nav-right">

        {onResources ? (
          <button type="button" className="nav-link" style={activePage === "resources" ? activeStyle : undefined} onClick={onResources}>Resources</button>
        ) : (
          <a href="/" className="nav-link" style={activePage === "resources" ? activeStyle : undefined}>Resources</a>
        )}

        <a href="/tools" className="nav-link" style={activePage === "tools" ? activeStyle : undefined}>GTM Tools</a>

        {onBlog ? (
          <button type="button" className="nav-link" style={activePage === "blog" ? activeStyle : undefined} onClick={onBlog}>Blog</button>
        ) : (
          <a href="/" className="nav-link" style={activePage === "blog" ? activeStyle : undefined}>Blog</a>
        )}

        {onCareers ? (
          <button type="button" className="nav-link" style={activePage === "careers" ? activeStyle : undefined} onClick={onCareers}>Careers</button>
        ) : (
          <a href="/" className="nav-link" style={activePage === "careers" ? activeStyle : undefined}>Careers</a>
        )}

        {onBookCall ? (
          <button type="button" className="nav-cta" onClick={onBookCall}>Give Us a Call</button>
        ) : (
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">Give Us a Call</a>
        )}

        <a href="/admin" className="nav-link" style={{ fontSize: 11, opacity: 0.5 }} title="Admin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </svg>
        </a>

      </div>
    </nav>
  );
}
