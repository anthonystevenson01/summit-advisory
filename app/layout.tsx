import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, DM_Mono, DM_Sans, Oswald } from "next/font/google";
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

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-oswald",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Summit Strategy Advisory — Vision. Action. Growth.",
  description: "We work alongside founders and leadership teams to create strategy and deliver sustained growth. AI Product Studio, Loyalty & Retail Media, Scale-Up Advisory.",
  metadataBase: new URL("https://summitadvisory.com"),
  openGraph: {
    title: "Summit Strategy Advisory — Vision. Action. Growth.",
    description: "We work alongside founders and leadership teams to create strategy and deliver sustained growth.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${barlow.variable} ${barlowCondensed.variable} ${dmMono.variable} ${dmSans.variable} ${oswald.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
