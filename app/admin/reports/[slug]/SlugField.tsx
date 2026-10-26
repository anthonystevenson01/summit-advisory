"use client";

import { useState } from "react";
import { slugify } from "@/app/lib/tools/report-model";

const fieldStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D0D5D2",
  fontSize: 14,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: "#1A1A1A",
  background: "#fff",
  boxSizing: "border-box" as const,
};

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600 as const, color: "#053030", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" };

/**
 * The company and slug inputs. While the slug is still the placeholder (or
 * empty) and has not been typed in, typing the company fills the slug with
 * its slugified form. Both are plain named fields in the server form.
 */
export default function SlugField({ company, slug, isPlaceholder }: { company: string; slug: string; isPlaceholder: boolean }) {
  const [companyValue, setCompanyValue] = useState(company);
  const [slugValue, setSlugValue] = useState(slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const suggest = !slugTouched && (isPlaceholder || slug.length === 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <label htmlFor="report-company" style={labelStyle}>Company</label>
        <input
          id="report-company"
          name="company"
          type="text"
          value={companyValue}
          onChange={(e) => {
            setCompanyValue(e.target.value);
            if (suggest) setSlugValue(e.target.value.trim() ? slugify(e.target.value) : slug);
          }}
          style={fieldStyle}
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="report-slug" style={labelStyle}>Slug</label>
        <input
          id="report-slug"
          name="slug"
          type="text"
          value={slugValue}
          onChange={(e) => {
            setSlugTouched(true);
            setSlugValue(e.target.value);
          }}
          style={{ ...fieldStyle, fontFamily: "monospace" }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0", lineHeight: 1.5 }}>
          Lowercase letters, digits and hyphens, 3 to 60 characters. Changing it moves the report; the old link stops working.
        </p>
      </div>
    </div>
  );
}
