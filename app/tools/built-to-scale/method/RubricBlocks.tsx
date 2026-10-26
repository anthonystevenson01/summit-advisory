import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import type { RubricBlock } from "@/app/lib/rubric-blocks";

const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

const paragraphStyle: CSSProperties = { fontSize: 15, lineHeight: 1.7, color: BRAND.dark, margin: "0 0 14px" };

function headingStyle(level: 1 | 2 | 3): CSSProperties {
  if (level === 3) return { fontFamily: SANS, fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "24px 0 10px", lineHeight: 1.3 };
  return { fontFamily: CONDENSED, fontSize: level === 1 ? 30 : 26, fontWeight: 700, color: BRAND.darkGreen, margin: "32px 0 12px", lineHeight: 1.15 };
}

/** The leading clause up to the first full stop, for the numbered steps. */
function splitLead(text: string): { lead: string; rest: string } {
  const i = text.indexOf(". ");
  if (i < 0) return { lead: text, rest: "" };
  return { lead: text.slice(0, i + 1), rest: text.slice(i + 1) };
}

/**
 * Structured rubric blocks to JSX with inline BRAND styles. Renders the row
 * as is, in order: nothing is picked by heading, so a reordering in Notion
 * changes the page without a deploy.
 */
export default function RubricBlocks({ blocks }: { blocks: RubricBlock[] }) {
  return (
    <div style={{ fontFamily: SANS }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h2" : "h3";
            return <Tag key={i} style={headingStyle(block.level)}>{block.text}</Tag>;
          }
          case "paragraph":
            return <p key={i} style={paragraphStyle}>{block.text}</p>;
          case "quote":
            return (
              <p key={i} style={{ ...paragraphStyle, paddingLeft: 16, borderLeft: `3px solid ${BRAND.brandGreen}`, color: BRAND.mid, fontStyle: "italic" }}>
                {block.text}
              </p>
            );
          case "bullets":
            return (
              <ul key={i} style={{ margin: "0 0 16px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 8 }}>
                {block.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 15, lineHeight: 1.6, color: BRAND.dark }}>{item}</li>
                ))}
              </ul>
            );
          case "numbered":
            return (
              <ol key={i} style={{ margin: "0 0 16px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                {block.items.map((item, j) => {
                  const { lead, rest } = splitLead(item);
                  return (
                    <li key={j} style={{ fontSize: 15, lineHeight: 1.6, color: BRAND.dark }}>
                      <span style={{ fontWeight: 600, color: BRAND.darkGreen }}>{lead}</span>
                      {rest}
                    </li>
                  );
                })}
              </ol>
            );
          case "table": {
            const [first, ...others] = block.rows;
            const headerRow = block.header ? first : null;
            const bodyRows = block.header ? others : block.rows;
            return (
              <div key={i} className="bts-table-wrap" style={{ margin: "0 0 20px", border: `1px solid ${BRAND.border}`, borderRadius: 8 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
                  {headerRow && (
                    <thead>
                      <tr>
                        {headerRow.map((cell, j) => (
                          <th
                            key={j}
                            style={{ fontFamily: CONDENSED, fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: BRAND.darkGreen, background: BRAND.lightBg, padding: "10px 12px", textAlign: "left", borderBottom: `1px solid ${BRAND.border}` }}
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {bodyRows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            style={{ fontSize: 14, lineHeight: 1.55, color: BRAND.dark, padding: "10px 12px", verticalAlign: "top", borderBottom: `1px solid ${BRAND.border}`, fontWeight: c === 0 ? 600 : 400 }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
