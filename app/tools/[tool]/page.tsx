import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolRunner from "./ToolRunner";
import { TOOL_SEO, TOOL_SLUGS, isToolHidden, isToolPublic, isToolSlug } from "./toolSlugs";

type Params = Promise<{ tool: string }>;

export function generateStaticParams() {
  return TOOL_SLUGS.filter((t) => !isToolHidden(t)).map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tool } = await params;
  if (!isToolSlug(tool) || isToolHidden(tool)) return {};
  const seo = TOOL_SEO[tool];
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      url: seo.canonical,
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ToolPage({ params }: { params: Params }) {
  const { tool } = await params;
  if (!isToolPublic(tool)) notFound();

  const seo = TOOL_SEO[tool];

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: seo.title.split(" —")[0],
    description: seo.about,
    url: seo.canonical,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: {
      "@type": "Organization",
      name: "Summit Strategy Advisory",
      url: "https://summitstrategyadvisory.com",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seo.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Interactive tool */}
      <ToolRunner slug={tool} />

      {/* Static FAQ section — always server-rendered */}
      <div
        style={{
          background: "#f8faf9",
          borderTop: "1px solid #e5eae7",
          padding: "56px 48px 64px",
        }}
      >
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color: "#053030",
              marginBottom: 32,
              letterSpacing: "0.01em",
            }}
          >
            Frequently Asked Questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {seo.faqs.map((faq, i) => (
              <div key={i}>
                <h3
                  style={{
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#053030",
                    marginBottom: 8,
                  }}
                >
                  {faq.q}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: 14,
                    color: "#4a5e58",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 48,
              paddingTop: 32,
              borderTop: "1px solid #e5eae7",
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontSize: 13,
              color: "#4a5e58",
            }}
          >
            Part of the{" "}
            <a href="/tools" style={{ color: "#053030", fontWeight: 600 }}>
              Summit GTM Toolkit
            </a>{" "}
            — five free tools for teams selling into finite markets. Built by{" "}
            <a href="/" style={{ color: "#053030", fontWeight: 600 }}>
              Summit Strategy Advisory
            </a>
            .
          </div>
        </div>
      </div>
    </>
  );
}
