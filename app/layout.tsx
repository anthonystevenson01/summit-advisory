import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
