"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import { BRAND } from "@/app/lib/brand";
import {
  COMPANY_LABEL,
  CONSENT_LABEL,
  CONSENT_LINE,
  EMAIL_HINT,
  EMAIL_LABEL,
  FILES_HINT,
  FILES_LABEL,
  FILE_COUNT_MESSAGE,
  FILE_SIZE_MESSAGE,
  FILE_TYPE_MESSAGE,
  GENERIC_MESSAGE,
  NAME_LABEL,
  PAGE_LEAD,
  PAGE_TITLE,
  PAUSED_BODY,
  PAUSED_HEADING,
  PREPARATION_LINE,
  REVIEW_PROMISE,
  SENDING,
  SUBMIT_LABEL,
  THANK_YOU_BODY,
  THANK_YOU_HEADING,
  THANK_YOU_NO_EMAIL,
  UPLOADING,
  UPLOAD_FAILED_MESSAGE,
  URL_HINT,
  URL_LABEL,
} from "@/app/lib/ask-summit/copy";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  contentTypeFor,
  fileTypeFromName,
  safeFileName,
  uploadPrefixFor,
  validateCompanyEmail,
  validateWebsiteUrl,
} from "@/app/lib/ask-summit/validation";
import CyclingLoader from "./shared/CyclingLoader";
import ErrMsg from "./shared/ErrMsg";

type Phase = "input" | "uploading" | "submitting" | "done" | "error";

interface ThankYou {
  site: string;
  files: string[];
  email: string;
  confirmationSent: boolean;
}

const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

const fieldStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 8,
  border: `1px solid ${BRAND.border}`,
  fontSize: 15,
  lineHeight: 1.5,
  fontFamily: SANS,
  color: BRAND.dark,
  background: BRAND.white,
  outline: "none",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s",
};

const labelStyle = {
  fontSize: 14,
  fontWeight: 600 as const,
  color: BRAND.darkGreen,
  display: "block",
  marginBottom: 4,
  letterSpacing: "0.02em",
};

const hintStyle = { fontSize: 12, color: BRAND.mid, margin: "0 0 8px", lineHeight: 1.5 };
const inlineErrorStyle = { fontSize: 12, color: BRAND.red, margin: "6px 0 0", lineHeight: 1.5 };

/** `ask_` plus 16 hex characters, the shape `REQUEST_ID_PATTERN` on the server accepts; minted here so uploads can start before the submit. */
function mintRequestId(): string {
  return `ask_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

function filesClause(names: string[]): string {
  if (names.length === 0) return "";
  return ` and ${names.length} file${names.length === 1 ? "" : "s"}: ${names.join(", ")}`;
}

/**
 * The Ask Summit form: website address, company email, name, company, up
 * to three documents, the consent line and the honeypot (named `nickname`
 * so a browser never autofills the real website into it). Files go straight
 * from the browser to Vercel Blob under a server-issued token, then the
 * submission posts their names and paths; the thank-you view shows names
 * only. The request id is minted on the first upload or submit and lives
 * in a ref, never rendered. A failed upload abandons the id; a retry mints
 * a new one.
 */
export default function AskSummitPage({ paused }: { paused: boolean }) {
  const [phase, setPhase] = useState<Phase>("input");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [nickname, setNickname] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState("");
  const [result, setResult] = useState<ThankYou | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const urlCheck = validateWebsiteUrl(url);
  const emailCheck = validateCompanyEmail(email);
  const formValid = urlCheck.ok && emailCheck.ok && consent && files.length <= MAX_FILES;
  const busy = phase === "uploading" || phase === "submitting";

  const fail = (message: string) => {
    setError(message);
    setPhase("error");
  };

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    setFileError(null);
    const next = [...files];
    for (const file of chosen) {
      if (next.some((f) => f.name === file.name)) continue;
      if (!fileTypeFromName(file.name)) {
        setFileError(FILE_TYPE_MESSAGE);
        continue;
      }
      if (file.size > MAX_FILE_BYTES || file.size === 0) {
        setFileError(FILE_SIZE_MESSAGE);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setFileError(FILE_COUNT_MESSAGE);
        break;
      }
      next.push(file);
    }
    setFiles(next);
  };

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setFileError(null);
  };

  const handleSubmit = async () => {
    if (!formValid || busy || !urlCheck.ok || !emailCheck.ok) return;
    setError(null);
    const requestId = requestIdRef.current ?? mintRequestId();
    requestIdRef.current = requestId;

    const uploaded: Array<{ name: string; pathname: string; url: string }> = [];
    if (files.length > 0) {
      setPhase("uploading");
      for (const file of files) {
        setUploading(fill(UPLOADING, { name: file.name }));
        const type = fileTypeFromName(file.name);
        if (!type) {
          fail(FILE_TYPE_MESSAGE);
          return;
        }
        try {
          const blob = await upload(`${uploadPrefixFor(requestId)}${safeFileName(file.name)}`, file, {
            access: "private",
            handleUploadUrl: "/api/ask-summit/upload",
            clientPayload: JSON.stringify({ requestId }),
            contentType: contentTypeFor(type),
          });
          uploaded.push({ name: file.name, pathname: blob.pathname, url: blob.url });
        } catch {
          requestIdRef.current = null;
          fail(UPLOAD_FAILED_MESSAGE);
          return;
        }
      }
    }

    setPhase("submitting");
    try {
      const res = await fetch("/api/ask-summit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, url, email, name, company, consent: true, nickname, files: uploaded }),
      });
      // Any answer but a 200 abandons the id (decision 4.13): the token count
      // under it is spent, so a retry mints a new one and uploads afresh.
      if (res.status === 503) {
        requestIdRef.current = null;
        fail(PAUSED_BODY);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; site?: string; files?: string[]; confirmationSent?: boolean };
      if (!res.ok) {
        requestIdRef.current = null;
        fail(data.error ?? GENERIC_MESSAGE);
        return;
      }
      setResult({ site: data.site ?? urlCheck.host, files: data.files ?? uploaded.map((f) => f.name), email: emailCheck.email, confirmationSent: data.confirmationSent === true });
      setPhase("done");
    } catch {
      requestIdRef.current = null;
      fail(GENERIC_MESSAGE);
    }
  };

  const focusBorder = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = BRAND.teal),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = BRAND.border),
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: SANS }}>
      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, padding: "40px 24px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(49,154,101,0.25)", border: "1px solid rgba(49,154,101,0.4)", marginBottom: 20 }}>
            <span style={{ color: BRAND.brandGreen, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Summit GTM Toolkit</span>
          </div>
          <h1 style={{ fontFamily: CONDENSED, fontSize: 46, fontWeight: 700, color: BRAND.white, lineHeight: 1.1, margin: "0 0 16px" }}>{PAGE_TITLE}</h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>{PAGE_LEAD}</p>
        </div>
      </section>

      {/* HOW THE PREPARATION WORKS */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 0" }}>
        <div style={{ padding: "16px 20px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
          <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.65, margin: "0 0 8px" }}>{PREPARATION_LINE}</p>
          <p style={{ fontSize: 13, color: BRAND.darkGreen, fontWeight: 600, lineHeight: 1.65, margin: 0 }}>{REVIEW_PROMISE}</p>
        </div>
      </section>

      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 56px" }}>
        {paused ? (
          <div style={{ padding: "28px 24px", background: BRAND.lightBg, borderRadius: 12, border: `1px solid ${BRAND.border}`, textAlign: "center" }}>
            <h2 style={{ fontFamily: CONDENSED, fontSize: 26, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 8px" }}>{PAUSED_HEADING}</h2>
            <p style={{ fontSize: 14, color: BRAND.mid, margin: 0, lineHeight: 1.6 }}>{PAUSED_BODY}</p>
          </div>
        ) : phase === "done" && result ? (
          <div style={{ padding: "28px 24px", background: BRAND.lightBg, borderRadius: 12, border: `1px solid ${BRAND.border}` }}>
            <h2 style={{ fontFamily: CONDENSED, fontSize: 26, fontWeight: 700, color: BRAND.darkGreen, margin: "0 0 8px" }}>{THANK_YOU_HEADING}</h2>
            <p style={{ fontSize: 15, color: BRAND.dark, margin: 0, lineHeight: 1.65 }}>
              {fill(result.confirmationSent ? THANK_YOU_BODY : THANK_YOU_NO_EMAIL, { site: result.site, files: filesClause(result.files), email: result.email })}
            </p>
          </div>
        ) : (
          <div>
            <input
              type="text"
              name="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              autoComplete="off"
            />

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="ask-url" style={labelStyle}>
                {URL_LABEL} <span style={{ color: BRAND.red }}>*</span>
              </label>
              <p style={hintStyle}>{URL_HINT}</p>
              <input id="ask-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} placeholder="https://yourcompany.com" style={fieldStyle} {...focusBorder} />
              {url.trim().length > 0 && !urlCheck.ok && <p style={inlineErrorStyle}>{urlCheck.error}</p>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="ask-email" style={labelStyle}>
                {EMAIL_LABEL} <span style={{ color: BRAND.red }}>*</span>
              </label>
              <p style={hintStyle}>{EMAIL_HINT}</p>
              <input id="ask-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="you@yourcompany.com" style={fieldStyle} {...focusBorder} />
              {email.trim().length > 0 && !emailCheck.ok && <p style={inlineErrorStyle}>{emailCheck.error}</p>}
            </div>

            <div className="bts-form-grid" style={{ marginBottom: 18 }}>
              <div>
                <label htmlFor="ask-name" style={labelStyle}>{NAME_LABEL}</label>
                <input id="ask-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} style={fieldStyle} {...focusBorder} />
              </div>
              <div>
                <label htmlFor="ask-company" style={labelStyle}>{COMPANY_LABEL}</label>
                <input id="ask-company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} disabled={busy} style={fieldStyle} {...focusBorder} />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="ask-files" style={labelStyle}>{FILES_LABEL}</label>
              <p style={hintStyle}>{FILES_HINT}</p>
              <input id="ask-files" type="file" accept=".pdf,.pptx,.docx" multiple onChange={onFilesChosen} disabled={busy || files.length >= MAX_FILES} style={{ fontSize: 14, fontFamily: SANS, width: "100%", maxWidth: "100%", boxSizing: "border-box" }} />
              {fileError && <p style={inlineErrorStyle}>{fileError}</p>}
              {files.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                  {files.map((file) => (
                    <li key={file.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 12px", background: BRAND.lightBg, borderRadius: 6, marginBottom: 6, fontSize: 13, color: BRAND.dark }}>
                      <span>
                        {file.name} <span style={{ color: BRAND.mid }}>({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
                      </span>
                      {!busy && (
                        <button type="button" onClick={() => removeFile(file.name)} style={{ background: "none", border: "none", padding: 0, color: BRAND.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: SANS }}>
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginBottom: 22, padding: "14px 16px", background: BRAND.lightBg, borderRadius: 8, border: `1px solid ${BRAND.border}` }}>
              <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.6, margin: "0 0 10px" }}>{CONSENT_LINE}</p>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: BRAND.darkGreen, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
                {CONSENT_LABEL}
              </label>
            </div>

            {!busy && phase !== "error" && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!formValid}
                  style={{
                    padding: "12px 28px",
                    borderRadius: 6,
                    border: "none",
                    background: formValid ? BRAND.brandGreen : BRAND.border,
                    color: BRAND.white,
                    fontFamily: CONDENSED,
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: "0.04em",
                    cursor: formValid ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                  }}
                >
                  {SUBMIT_LABEL}
                </button>
              </div>
            )}

            {busy && (
              <div style={{ padding: "24px 0" }}>
                <CyclingLoader dark={false} messages={phase === "uploading" ? [uploading || SENDING] : [SENDING]} />
              </div>
            )}

            {phase === "error" && error && (
              <div style={{ padding: "16px 0" }}>
                <ErrMsg
                  msg={error}
                  dark={false}
                  retry={() => {
                    setError(null);
                    setPhase("input");
                  }}
                />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
