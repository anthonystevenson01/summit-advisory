/**
 * Ask Summit validation: the website URL, the same-host rule, the company
 * email rule, the file types by extension and magic bytes, the limits and
 * the request id shapes. Pure module, no env.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  FREE_MAIL_DOMAINS,
  MAX_FILE_BYTES,
  fileTypeFromName,
  hostOf,
  isAskRequestId,
  isSameHost,
  isUnderPrefix,
  safeFileName,
  sniffFileType,
  uploadPrefixFor,
  validateCompanyEmail,
  validateFileMeta,
  validateWebsiteUrl,
} from "../app/lib/ask-summit/validation.ts";
import { ASK_SUMMIT_COPY, FREE_MAIL_MESSAGE, FILE_COUNT_MESSAGE, FILE_SIZE_MESSAGE, FILE_TYPE_MESSAGE, URL_MESSAGE } from "../app/lib/ask-summit/copy.ts";

const DASH_RE = /[–—]| - /;
const ID = "ask_0123456789abcdef";

describe("validateWebsiteUrl", () => {
  test("accepts http and https and normalises the host", () => {
    const a = validateWebsiteUrl("https://example.com");
    assert.ok(a.ok && a.url === "https://example.com/" && a.host === "example.com");
    const b = validateWebsiteUrl("http://example.com/path");
    assert.ok(b.ok && b.url === "http://example.com/path");
    const c = validateWebsiteUrl("EXAMPLE.com");
    assert.ok(c.ok && c.url === "https://example.com/" && c.host === "example.com");
  });

  test("drops the fragment and keeps the query on the start URL", () => {
    const r = validateWebsiteUrl("https://Example.com/products?lang=en#top");
    assert.ok(r.ok && r.url === "https://example.com/products?lang=en");
  });

  test("rejects other schemes, bare words, IP literals, local hosts, credentials and long values", () => {
    for (const bad of [
      "ftp://example.com",
      "javascript:alert(1)",
      "example",
      "http://192.168.1.1",
      "http://localhost",
      "http://localhost:3000",
      "http://intranet.local",
      "http://user:pass@example.com",
      `https://example.com/${"a".repeat(2049)}`,
      "",
      "   ",
    ]) {
      const r = validateWebsiteUrl(bad);
      assert.equal(r.ok, false, bad);
      assert.ok(!r.ok && r.error === URL_MESSAGE);
    }
    assert.equal(validateWebsiteUrl(42).ok, false);
  });
});

describe("isSameHost and hostOf", () => {
  test("www is one site, a subdomain another", () => {
    assert.equal(isSameHost("www.example.com", "example.com"), true);
    assert.equal(isSameHost("https://www.example.com/a", "https://example.com/b"), true);
    assert.equal(isSameHost("blog.example.com", "example.com"), false);
    assert.equal(isSameHost("Example.COM", "example.com"), true);
    assert.equal(hostOf("https://WWW.Example.com/x"), "example.com");
    assert.equal(hostOf(""), null);
  });
});

describe("validateCompanyEmail", () => {
  test("a company address passes with the domain lowercased", () => {
    const r = validateCompanyEmail("  Ann@Acme.IO ");
    assert.ok(r.ok && r.email === "Ann@acme.io" && r.domain === "acme.io");
  });

  test("free mail domains are refused with the exact message", () => {
    for (const domain of ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.co.uk", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "mail.com"]) {
      assert.ok(FREE_MAIL_DOMAINS.includes(domain), domain);
      const r = validateCompanyEmail(`ann@${domain.toUpperCase()}`);
      assert.ok(!r.ok && r.error === FREE_MAIL_MESSAGE, domain);
    }
  });

  test("an unshaped address is refused", () => {
    for (const bad of ["ann", "ann@", "@acme.io", "ann@acme", "ann @acme.io", "ann@@acme.io", `${"a".repeat(250)}@acme.io`]) {
      assert.equal(validateCompanyEmail(bad).ok, false, bad);
    }
  });

  test("the message contains no dashes", () => {
    assert.doesNotMatch(FREE_MAIL_MESSAGE, DASH_RE);
  });
});

describe("files", () => {
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

  test("fileTypeFromName reads the last extension, case insensitive", () => {
    assert.equal(fileTypeFromName("deck.pdf"), "pdf");
    assert.equal(fileTypeFromName("Deck.PPTX"), "pptx");
    assert.equal(fileTypeFromName("plan.docx"), "docx");
    for (const name of ["plan.doc", "deck.ppt", "notes.txt", "deck.pdf.exe", ".pdf", "pdf"]) assert.equal(fileTypeFromName(name), null, name);
  });

  test("sniffFileType needs the magic bytes to match the extension", () => {
    assert.equal(sniffFileType(PDF, "deck.pdf"), "pdf");
    assert.equal(sniffFileType(ZIP, "plan.docx"), "docx");
    assert.equal(sniffFileType(ZIP, "deck.pptx"), "pptx");
    assert.equal(sniffFileType(ZIP, "deck.pdf"), null);
    assert.equal(sniffFileType(PDF, "plan.docx"), null);
    assert.equal(sniffFileType(new Uint8Array(0), "deck.pdf"), null);
    assert.equal(sniffFileType(PDF, "notes.txt"), null);
  });

  test("validateFileMeta enforces the count, the size, the extension and the name", () => {
    const good = [
      { name: "deck.pdf", size: 10 },
      { name: "plan.docx", size: MAX_FILE_BYTES },
      { name: "slides.pptx", size: 1, contentType: "application/octet-stream" },
    ];
    const ok = validateFileMeta(good);
    assert.ok(ok.ok && ok.files.map((f) => f.type).join(",") === "pdf,docx,pptx");

    const four = validateFileMeta([...good, { name: "extra.pdf", size: 1 }]);
    assert.ok(!four.ok && four.error === FILE_COUNT_MESSAGE);
    const big = validateFileMeta([{ name: "deck.pdf", size: MAX_FILE_BYTES + 1 }]);
    assert.ok(!big.ok && big.error === FILE_SIZE_MESSAGE);
    const empty = validateFileMeta([{ name: "deck.pdf", size: 0 }]);
    assert.ok(!empty.ok && empty.error === FILE_SIZE_MESSAGE);
    const type = validateFileMeta([{ name: "notes.txt", size: 10 }]);
    assert.ok(!type.ok && type.error === FILE_TYPE_MESSAGE);
    const long = validateFileMeta([{ name: `${"a".repeat(201)}.pdf`, size: 10 }]);
    assert.equal(long.ok, false);
    const dupe = validateFileMeta([{ name: "deck.pdf", size: 10 }, { name: "deck.pdf", size: 10 }]);
    assert.equal(dupe.ok, false);
    const badType = validateFileMeta([{ name: "deck.pdf", size: 10, contentType: "text/plain" }]);
    assert.ok(!badType.ok && badType.error === FILE_TYPE_MESSAGE);
  });

  test("safeFileName keeps the extension and strips unsafe characters", () => {
    assert.equal(safeFileName("Q3 Deck (final).PDF"), "Q3-Deck-final.pdf");
    assert.equal(safeFileName("../../etc/passwd.docx"), "etc-passwd.docx");
    assert.ok(safeFileName(`${"x".repeat(300)}.pptx`).length <= 120);
  });
});

describe("request ids and the upload prefix", () => {
  test("isAskRequestId accepts ask_ plus 16 hex and rejects a run id", () => {
    assert.equal(isAskRequestId(ID), true);
    assert.equal(isAskRequestId("run_0123456789abcdef"), false);
    assert.equal(isAskRequestId("ask_0123456789ABCDEF"), false);
    assert.equal(isAskRequestId("ask_0123"), false);
    assert.equal(isAskRequestId(null), false);
  });

  test("uploadPrefixFor and isUnderPrefix", () => {
    assert.equal(uploadPrefixFor(ID), `ask-summit/${ID}/`);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/deck.pdf`, ID), true);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/deck-x9y8z7.pdf`, ID), true);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/a/deck.pdf`, ID), false);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/..deck.pdf`, ID), false);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/`, ID), false);
    assert.equal(isUnderPrefix("other/deck.pdf", ID), false);
    assert.equal(isUnderPrefix(`ask-summit/${ID}/deck.pdf`, "ask_0000000000000000"), false);
  });
});

describe("copy", () => {
  test("every string carries no dash and the key lines say what they must", () => {
    for (const [key, value] of Object.entries(ASK_SUMMIT_COPY)) assert.doesNotMatch(value, DASH_RE, key);
    assert.ok(ASK_SUMMIT_COPY.CONSENT_LINE.includes("30 days"));
    assert.ok(ASK_SUMMIT_COPY.CONSENT_LINE.includes("train"));
    assert.ok(ASK_SUMMIT_COPY.CONSENT_LINE.includes("delete-my-data"));
    assert.ok(ASK_SUMMIT_COPY.REVIEW_PROMISE.includes("two working days"));
    assert.ok(ASK_SUMMIT_COPY.PREPARATION_LINE.includes("preparation, not the result"));
  });
});
