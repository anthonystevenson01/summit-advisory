# Review: Project Builder "Prototype so far"

Branch: `anthonystevenson0/project-builder-prototype`
Final verdict: **APPROVE** (loop 2; one REJECT in loop 1)

## Loop 1: REJECT

The gates passed (npm test 498/498, lint 0, tsc clean, build ok), and acceptance criteria 1 to 24 and 21a to 21e passed except AC14 (safety pass).

1. `sanitisePrototypeHtml` put the CSP after the first regex match of `<head`. Model output could place it inside a comment, behind an earlier inline script, or into the body, after an element such as `<head-x>`. In each case the CSP was missing or applied too late.
2. The attribute patterns needed whitespace before the attribute name, so `<script/src=...>`, `<form/action=...>`, `<img/srcset=...>` and `<a/href="javascript:...">` got through.
3. There were no regression tests for either problem.

Also asked for: the prototype hash ignored the contact website and the email domain.

## Loop 2: APPROVE

The gates pass: npm test 503/503, lint 0, tsc clean, build ok.

1. **CSP placement fixed.** Every output is now `<!DOCTYPE html>`, then the safe block, then the content, whatever shape the document has. These bypasses were tested and stopped:
   - the original three (a comment containing `<head>`, a script before the head, `<head-x>`)
   - a BOM followed by text before the doctype
   - nested comments
   - a model-written refresh meta and a second CSP meta
   - a smuggled marker

   The pass is idempotent, and stored prototypes are corrected when they are served.
2. **Slash separator handled.** The fix covers the prototype sanitiser, the logo patterns and `sanitiseSvg`.
3. **Regression tests added.** They cover the five document shapes, the slash case, and the SVG slash case.
4. **Website now in the hash.** The prototype hash uses the resolved website: Step 1 first, then the contact website, then a company email domain.

## Notes for the PR (non-blocking)

- **Up-to-date label.** The dock hashes the contact details as typed, and the server hashes the stored ones. The label can briefly disagree with the server. The server's answer is the one that counts.
- **SSRF limits.** Fetches check the hostname only. A public name that resolves to a private IP is not caught, and when redirects are followed only the final URL is checked. The existing Ask Summit crawler has the same limits. A follow-up could use manual redirects with a check on each hop, plus a DNS resolve check.
- **Frame navigation.** Script inside the sandbox can still navigate the frame itself. The sandbox keeps the builder's own origin safe.
- **Time limit.** `maxDuration = 300` needs a Vercel plan that allows it.
- **No live run yet.** Smoke test Create, then Update through edits, against a real company site before merging.

## UI change round (after preview test): APPROVE

Anthony asked for six changes after testing the preview. All six are done:

1. The prototype tab is teal, so it no longer looks like the blueprint tab.
2. When open, the panel fills most of the screen.
3. The builder tab no longer offers full screen. The read-only and admin views keep it.
4. One Create/Update button sits next to Save.
5. The tab opens when the button is pressed and stays open when the prototype is ready.
6. The empty line has been fixed.

The gates pass: npm test 507/507, lint 0 errors, tsc clean. The sandbox and the frame are unchanged.

Non-blocking notes:
- When the brief is not ready, the readiness line and the empty line repeat each other.
- `finally` reopens the tab even if the user closed it during generation.
- Check a phone held sideways on a real device.
