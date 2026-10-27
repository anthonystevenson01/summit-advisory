"use client";

import { BRAND } from "@/app/lib/brand";
import { isFreeMailAddress } from "@/app/lib/project-builder/brief";
import { CONSENT_LINE, CONTACT, FREE_MAIL_PROMPT, MARKETING_LABEL } from "@/app/lib/project-builder/copy";
import { SANS, err, field, fieldWrap, label } from "./builder-styles";

export interface ContactDraft {
  name: string;
  email: string;
  company: string;
  website: string;
  marketing: boolean;
}

export const EMPTY_CONTACT: ContactDraft = { name: "", email: "", company: "", website: "", marketing: false };

export interface ContactFieldsProps {
  contact: ContactDraft;
  onChange: (patch: Partial<ContactDraft>) => void;
  error: string;
  idPrefix: string;
}

/**
 * Name, work email, company, website, the consent line and the unticked
 * marketing box. The free mail prompt shows under the email once the
 * address is one of the free mail domains; the address is still allowed.
 * The website input is named `companyWebsite`, never `website`, which is
 * the honeypot field name on every builder route.
 */
export default function ContactFields({ contact, onChange, error, idPrefix }: ContactFieldsProps) {
  const freeMail = isFreeMailAddress(contact.email);
  return (
    <>
      {error && <p style={err} role="alert">{error}</p>}
      <div style={fieldWrap}>
        <label htmlFor={`${idPrefix}-name`} style={label}>{CONTACT.name}</label>
        <input id={`${idPrefix}-name`} type="text" name="fullName" value={contact.name} onChange={(e) => onChange({ name: e.target.value })} autoComplete="name" style={field} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor={`${idPrefix}-email`} style={label}>{CONTACT.email}</label>
        <input id={`${idPrefix}-email`} type="email" name="workEmail" value={contact.email} onChange={(e) => onChange({ email: e.target.value })} autoComplete="email" style={field} />
        {freeMail && <p style={{ fontSize: 14, color: BRAND.teal, margin: "6px 0 0", fontFamily: SANS }}>{FREE_MAIL_PROMPT}</p>}
      </div>
      <div className="pb-two">
        <div style={fieldWrap}>
          <label htmlFor={`${idPrefix}-company`} style={label}>{CONTACT.company}</label>
          <input id={`${idPrefix}-company`} type="text" name="companyName" value={contact.company} onChange={(e) => onChange({ company: e.target.value })} autoComplete="organization" style={field} />
        </div>
        <div style={fieldWrap}>
          <label htmlFor={`${idPrefix}-web`} style={label}>{CONTACT.website}</label>
          <input id={`${idPrefix}-web`} type="text" name="companyWebsite" value={contact.website} onChange={(e) => onChange({ website: e.target.value })} placeholder={CONTACT.websitePlaceholder} autoComplete="url" style={field} />
        </div>
      </div>
      <div style={{ fontSize: 14, margin: "4px 0 16px", fontFamily: SANS, color: BRAND.teal, lineHeight: 1.5 }}>
        <p style={{ margin: "0 0 8px" }}>{CONSENT_LINE}</p>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400, cursor: "pointer" }}>
          <input type="checkbox" checked={contact.marketing} onChange={(e) => onChange({ marketing: e.target.checked })} style={{ marginTop: 3 }} />
          <span>{MARKETING_LABEL}</span>
        </label>
      </div>
    </>
  );
}
