# Review: Built to Scale? Release 1b, gate and capture

Branch `anthonystevenson0/built-to-scale-1b-gate`. Design: `docs/designs/anthonystevenson0-built-to-scale-1b-gate.md`. Two review rounds.

## Round 1: REJECT

Gates verified by the Reviewer: `npm test` 135 pass, `npm run lint` 0 errors (after `.claude/**` was added to the eslint ignores, because the Claude app's parallel worktrees live there), `npx tsc --noEmit` clean, `npm run build` green with `/tools/[tool]` still statically generated. All 12 acceptance criteria passed. One constraint failed.

1. The result-email failure path logged the raw nodemailer error. Mail servers echo the recipient in rejection text ("550 5.1.1 <ann@example.com>: Recipient address rejected"), so a bounce would log the visitor's address in full, against the rule to log only the hash.

## Round 2: APPROVE

Fix verified: `redactAddresses(message)` exported from `app/lib/tools/result-email.ts` replaces anything shaped like an address with `[address]`; the details route passes the transport error through it before logging; one pure test covers a rejection string and an unrelated connection error. Gates re-run by the Reviewer: `npm test` 136 pass, lint 0 errors, tsc clean, build green.

### Acceptance criteria

All 12 PASS. The runbook entry is the Docs agent's deliverable and is confirmed before the PR opens.

### Constraints

All PASS. `UNLOCK_SECRET` is read in `app/lib/unlock.ts` only. No address reaches a log. Newsletter untouched. Scoring, rubrics, routing, `llm.ts` and `rubrics.ts` untouched; `scoreRun`'s record literal gained two null defaults required by the type. Inline BRAND styling. No dashes in touched copy. Tests pure and offline. `maxDuration` kept with the send budgeted inside it. Cookie httpOnly, signed, hash only. Release 2 files untouched.

### Test coverage

Token sign and verify (valid, tampered payload, tampered signature, expired at and past the limit, wrong secret, purpose mismatch, malformed, wrong version); `validateUnlock` with email only, optional fields, bad and missing email; email template fields, both links, escaping, dash normalisation, no-recommendations line; address redaction. Route and Redis paths (cookie skip, emailed result, saved link, deletion, per-email index, the two new events) are integration paths excluded from unit tests and not yet exercised live.

### Notes for PR (non-blocking)

- Live smoke not yet run: cookie flow, emailed result, saved link, delete flow and the `runs:by-email` index need a preview with `UNLOCK_SECRET` set and SMTP pointed at a test inbox.
- Timeout stacking: nodemailer's connection, greeting and socket timeouts are each set to the remaining budget and are sequential, so a host that stalls at every stage could exceed it. The full view is already persisted, so a retry serves the stored view. Follow-up: race the send against the remaining budget.
- Three legacy routes (`ai-studio-request`, `admin/reset-request`, `crm-interest`) still create their own nodemailer transports. Follow-up to route them through `app/lib/mail.ts`.
- `signToken` spreads claims after the purpose, so a claim named `p` would override it. All callers use fixed claim names; worth a guard if reused.
- Design decisions flagged for the human: the delete POST clears a matching unlock cookie; `gtm-unlocks` is not purged on delete.
- Runs unlocked before this deploy are not in the per-email index, so the delete link does not cover 1a-era runs. A backfill script is a follow-up if wanted.
- The eslint ignore for `.claude/**` is unrelated to the feature and is called out in the PR body.
