/**
 * Summit Strategy Advisory brand constants.
 * Single source of truth — import everywhere instead of redefining locally.
 */
export const BRAND = {
  darkGreen: "#053030",
  teal: "#005A66",
  brandGreen: "#319A65",
  lightBg: "#F0F7F4",
  white: "#FFFFFF",
  dark: "#1A1A1A",
  mid: "#666666",
  border: "#D0D5D2",
  red: "#C0392B",
  amber: "#D4A017",
  lightTeal: "#E6F2F4",
} as const;

export type BrandColor = keyof typeof BRAND;

/** The Google Calendar booking page behind every "Book a Call" and "Book 30 minutes" button. */
export const BOOK_CALL_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

/** The address in the site's Organization schema, the hub's "Ask Summit" card and the report's correction line. */
export const CONTACT_EMAIL = "info@summitstrategyadvisory.com";
