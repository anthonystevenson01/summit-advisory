import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Summit Strategy Advisory — Vision. Action. Growth.",
  description:
    "We build AI products with founders, grow retail media networks, and lead GTM strategy at B2B scale-ups. Three advisory practices. One standard: we own the outcome, not just the advice.",
  metadataBase: new URL("https://summitstrategyadvisory.com"),
  alternates: {
    canonical: "https://summitstrategyadvisory.com",
  },
  openGraph: {
    title: "Summit Strategy Advisory — Vision. Action. Growth.",
    description:
      "AI products for founders, retail media for large retailers, GTM leadership for B2B scale-ups. We own the outcome, not just the advice.",
    url: "https://summitstrategyadvisory.com",
    siteName: "Summit Strategy Advisory",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Summit Strategy Advisory — Vision. Action. Growth.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Summit Strategy Advisory — Vision. Action. Growth.",
    description:
      "AI products for founders, retail media for large retailers, GTM leadership for B2B scale-ups. We own the outcome, not just the advice.",
    images: ["/opengraph-image"],
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Summit Strategy Advisory",
  url: "https://summitstrategyadvisory.com",
  logo: "https://summitstrategyadvisory.com/brand-icons/Combination%20Mark_White.png",
  description:
    "Strategy advisory working alongside founders and leadership teams. Three practice areas: AI Product Studio, Loyalty & Retail Media, Scale-Up Advisory.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Vancouver",
    addressRegion: "BC",
    addressCountry: "CA",
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@summitstrategyadvisory.com",
    contactType: "customer service",
  },
  sameAs: [
    "https://www.linkedin.com/company/summit-strategy-advisory",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${barlow.variable} ${barlowCondensed.variable} ${dmMono.variable} ${dmSans.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
