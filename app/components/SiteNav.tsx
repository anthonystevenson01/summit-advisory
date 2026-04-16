"use client";

import { useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const activeStyle = { color: "rgba(255,255,255,0.9)", cursor: "default" as const };

  function handleNav(handler?: () => void) {
    setMenuOpen(false);
    handler?.();
  }

  return (
    <>
      <nav className="nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_WHITE}
          alt="Summit Strategy Advisory"
          className="nav-logo"
          onClick={() => handleNav(onLogoClick ?? (() => { window.location.href = "/"; }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleNav(onLogoClick ?? (() => { window.location.href = "/"; }))}
        />

        {/* Desktop nav links */}
        <div className="nav-right">
          {onResources ? (
            <button type="button" className="nav-link" style={activePage === "resources" ? activeStyle : undefined} onClick={() => handleNav(onResources)}>Resources</button>
          ) : (
            <a href="/?page=resources" className="nav-link" style={activePage === "resources" ? activeStyle : undefined}>Resources</a>
          )}

          <a href="/tools" className="nav-link" style={activePage === "tools" ? activeStyle : undefined}>GTM Tools</a>

          {onBlog ? (
            <button type="button" className="nav-link" style={activePage === "blog" ? activeStyle : undefined} onClick={() => handleNav(onBlog)}>Blog</button>
          ) : (
            <a href="/?page=blog" className="nav-link" style={activePage === "blog" ? activeStyle : undefined}>Blog</a>
          )}

          {onCareers ? (
            <button type="button" className="nav-link" style={activePage === "careers" ? activeStyle : undefined} onClick={() => handleNav(onCareers)}>Careers</button>
          ) : (
            <a href="/?page=careers" className="nav-link" style={activePage === "careers" ? activeStyle : undefined}>Careers</a>
          )}

          {onBookCall ? (
            <button type="button" className="nav-cta" onClick={() => handleNav(onBookCall)}>Give Us a Call</button>
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

        {/* Mobile hamburger */}
        <button
          type="button"
          className="nav-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="18" y2="18" />
              <line x1="18" y1="4" x2="4" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="19" y2="6" />
              <line x1="3" y1="11" x2="19" y2="11" />
              <line x1="3" y1="16" x2="19" y2="16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          {onResources ? (
            <button type="button" className="nav-mobile-link" onClick={() => handleNav(onResources)}>Resources</button>
          ) : (
            <a href="/?page=resources" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Resources</a>
          )}

          <a href="/tools" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>GTM Tools</a>

          {onBlog ? (
            <button type="button" className="nav-mobile-link" onClick={() => handleNav(onBlog)}>Blog</button>
          ) : (
            <a href="/?page=blog" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Blog</a>
          )}

          {onCareers ? (
            <button type="button" className="nav-mobile-link" onClick={() => handleNav(onCareers)}>Careers</button>
          ) : (
            <a href="/?page=careers" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Careers</a>
          )}

          {onBookCall ? (
            <button type="button" className="nav-mobile-cta" onClick={() => handleNav(onBookCall)}>Give Us a Call</button>
          ) : (
            <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="nav-mobile-cta" onClick={() => setMenuOpen(false)}>Give Us a Call</a>
          )}
        </div>
      )}
    </>
  );
}
