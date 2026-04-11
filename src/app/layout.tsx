import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

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
  title: "Water System Explorer",
  description: "Explore community water systems",
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
