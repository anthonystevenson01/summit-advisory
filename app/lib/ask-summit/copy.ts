/**
 * Every string the Ask Summit page, form, thank-you view, paused state and
 * consent line show, plus the hub card's call to action and the messages the
 * submit route returns. Pure: one import from brand.ts, so the tests load it
 * under plain Node and pin the house rules (British spelling, no dashes, no
 * hype) in one place.
 */
import { CONTACT_EMAIL } from "../brand.ts";

export const PAGE_TITLE = "Ask Summit to score it";

export const PAGE_LEAD =
  "Give us your website and a deck. We run the same tools, then a person reads the output, checks it against what we know, edits the scores and writes the commentary.";

export const PAGE_DESCRIPTION =
  "Give Summit your website and a deck. The tools draft the five parts of Built to Scale? and score them, then a person reads the output, checks it, edits the scores and writes the commentary. A reviewed report, usually within two working days.";

export const PREPARATION_LINE =
  "How the preparation works: a model reads your website and documents and drafts the five parts of the Built to Scale? form, then the tools score that draft automatically. That is preparation, not the result.";

export const REVIEW_PROMISE =
  "A person reads the output, checks it, edits the scores and writes the commentary; usually within two working days.";

export const CONSENT_LINE =
  "Summit keeps the pages it reads from your website and the files you upload for 30 days to prepare the report, then deletes them. Nothing you send is used to train any model. The confirmation email carries a delete-my-data link that removes them sooner.";

export const CONSENT_LABEL = "I agree";

export const URL_LABEL = "Website address";
export const URL_HINT = "Starting with http or https. We read up to 40 pages on this domain and nothing outside it.";
export const EMAIL_LABEL = "Company email";
export const EMAIL_HINT = "A free mail address will not be accepted; Summit commits a person's time to each request.";
export const NAME_LABEL = "Your name (optional)";
export const COMPANY_LABEL = "Company (optional)";
export const FILES_LABEL = "Documents (optional, up to three)";
export const FILES_HINT = "PDF, PowerPoint or Word, 25 MB each. A deck is the most useful.";
export const SUBMIT_LABEL = "Send it to Summit";

/** `{name}` is replaced with the file being uploaded. */
export const UPLOADING = "Uploading {name}";
export const SENDING = "Sending to Summit";

export const THANK_YOU_HEADING = "Thank you, we have it";

/** `{site}`, `{files}` and `{email}` are replaced by the page. */
export const THANK_YOU_BODY =
  "We have {site}{files}. A confirmation is on its way to {email} with the turnaround and your delete-my-data link. A person will read the output and send you the reviewed report, usually within two working days.";

export const THANK_YOU_NO_EMAIL =
  "We have {site}{files}. We could not send the confirmation email, but your request is in. A person will read the output and send you the reviewed report, usually within two working days.";

export const PAUSED_HEADING = "Not taking requests right now";
export const PAUSED_BODY = `Summit is not taking new requests at the moment. Please try again in a few days, or write to ${CONTACT_EMAIL}.`;

export const FREE_MAIL_MESSAGE =
  "Please use a company email address. Free mail addresses such as Gmail, Outlook, Hotmail, Yahoo, iCloud and Proton are not accepted for this request, because Summit commits a person's time to each one.";
export const EMAIL_MESSAGE = "Enter a company email address.";
export const URL_MESSAGE = "Enter your website address, starting with http or https.";
export const FILE_TYPE_MESSAGE = "Only PDF, PowerPoint (.pptx) and Word (.docx) files can be read.";
export const FILE_SIZE_MESSAGE = "Each file must be 25 MB or smaller.";
export const FILE_COUNT_MESSAGE = "Up to three files.";
export const FILE_NAME_MESSAGE = "File names must be 1 to 200 characters and each file named once.";
export const CONSENT_MESSAGE = "Please agree to the retention line.";
export const RELOAD_MESSAGE = "Please reload the page and try again.";
export const REPLAY_MESSAGE = "This request was already sent.";
export const RATE_LIMIT_EMAIL_MESSAGE = "Two requests a day from one address is the limit. Please try again tomorrow.";
export const RATE_LIMIT_IP_MESSAGE = "Five requests a day from one connection is the limit. Please try again tomorrow.";
export const UPLOAD_FAILED_MESSAGE = "A file did not upload. Check the file and try again.";
export const UPLOADS_UNCONFIGURED_MESSAGE = "Uploads are not configured. Send the request without files, or try again later.";
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export const DELETE_FALLBACK_LINE = `To have your data deleted sooner, write to ${CONTACT_EMAIL} from the address you used.`;

export const HUB_CTA = "Ask Summit to score it";

/** Every constant above, for the test that checks the house rules in one loop. */
export const ASK_SUMMIT_COPY = {
  PAGE_TITLE,
  PAGE_LEAD,
  PAGE_DESCRIPTION,
  PREPARATION_LINE,
  REVIEW_PROMISE,
  CONSENT_LINE,
  CONSENT_LABEL,
  URL_LABEL,
  URL_HINT,
  EMAIL_LABEL,
  EMAIL_HINT,
  NAME_LABEL,
  COMPANY_LABEL,
  FILES_LABEL,
  FILES_HINT,
  SUBMIT_LABEL,
  UPLOADING,
  SENDING,
  THANK_YOU_HEADING,
  THANK_YOU_BODY,
  THANK_YOU_NO_EMAIL,
  PAUSED_HEADING,
  PAUSED_BODY,
  FREE_MAIL_MESSAGE,
  EMAIL_MESSAGE,
  URL_MESSAGE,
  FILE_TYPE_MESSAGE,
  FILE_SIZE_MESSAGE,
  FILE_COUNT_MESSAGE,
  FILE_NAME_MESSAGE,
  CONSENT_MESSAGE,
  RELOAD_MESSAGE,
  REPLAY_MESSAGE,
  RATE_LIMIT_EMAIL_MESSAGE,
  RATE_LIMIT_IP_MESSAGE,
  UPLOAD_FAILED_MESSAGE,
  UPLOADS_UNCONFIGURED_MESSAGE,
  GENERIC_MESSAGE,
  DELETE_FALLBACK_LINE,
  HUB_CTA,
} as const;
