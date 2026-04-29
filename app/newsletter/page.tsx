import type { Metadata } from "next";
import NewsletterHub from "@/app/components/newsletter/NewsletterHub";

export const metadata: Metadata = {
  title: "The Scale-Up Letter — Weekly GTM Thinking for B2B Leaders",
  description:
    "Practical GTM thinking for scale-up leaders selling into finite, defined markets. One essay per week. No generic advice, no padding. Free to subscribe.",
  alternates: { canonical: "https://summitstrategyadvisory.com/newsletter" },
  openGraph: {
    title: "The Scale-Up Letter — Weekly GTM Thinking for B2B Leaders",
    description:
      "Practical GTM thinking for scale-up leaders selling into finite markets. One essay per week. Free to subscribe.",
    url: "https://summitstrategyadvisory.com/newsletter",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Scale-Up Letter — Weekly GTM Thinking for B2B Leaders",
    description:
      "Practical GTM thinking for scale-up leaders selling into finite markets. One essay per week.",
    images: ["/opengraph-image"],
  },
};

const newsletterSchema = {
  "@context": "https://schema.org",
  "@type": "Newsletter",
  name: "The Scale-Up Letter",
  description:
    "Weekly GTM thinking for B2B scale-up leaders selling into finite, named-account markets. Published by Summit Strategy Advisory.",
  url: "https://summitstrategyadvisory.com/newsletter",
  publisher: {
    "@type": "Organization",
    name: "Summit Strategy Advisory",
    url: "https://summitstrategyadvisory.com",
  },
  inLanguage: "en",
  isAccessibleForFree: true,
};

export default function NewsletterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsletterSchema) }}
      />
      <NewsletterHub />
    </>
  );
}
