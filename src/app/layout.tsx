import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const SITE_TITLE =
  "The New Grid | Examine the impacts of data centers, e-commerce shipping hubs and more on your life";

const SITE_DESCRIPTION = "Explore community water systems";

/** Canonical origin for OG/Twitter absolute URLs (link previews ignore relative images). */
function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw);
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Tab icon: `src/app/icon.png` (Next file convention). Apple / OG use public favicon.
  icons: {
    apple: [{ url: "/favicon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "The New Grid",
    type: "website",
    images: [{ url: "/favicon.png", width: 100, height: 100, alt: "The New Grid" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable}`}>
        <AuthProvider>{children}</AuthProvider>
        <Script
          strategy="lazyOnload"
          src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
          data-name="BMC-Widget"
          data-cfasync="false"
          data-id="petedamato"
          data-description="Support me on Buy me a coffee!"
          data-message="I need your support to expand our data coverage."
          data-color="#FF813F"
          data-position="Right"
          data-x_margin="18"
          data-y_margin="18"
        />
      </body>
    </html>
  );
}
