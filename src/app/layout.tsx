import type { Metadata } from "next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/sonner";

import { Providers } from "./providers";
import "./globals.css";

const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400" },
    { path: "../fonts/JetBrainsMono-Medium.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chatly",
    template: "%s — Chatly",
  },
  description: "Real-time chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
