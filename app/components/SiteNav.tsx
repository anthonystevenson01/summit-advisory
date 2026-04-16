"use client";

import { useState } from "react";
import Image from "next/image";
import { HamburgerIcon, CloseIcon, UserIcon } from "./icons";

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
        <Image
          src={LOGO_WHITE}
          alt="Summit Strategy Advisory"
          width={160}
          height={28}
          priority
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
            <UserIcon />
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
          {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
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
