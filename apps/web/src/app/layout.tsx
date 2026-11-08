import type { Metadata } from "next";
import localFont from "next/font/local";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

const helveticaNeue = localFont({
  src: [
    { path: "./fonts/helvetica-neue-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/helvetica-neue-medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/helvetica-neue-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-helvetica-neue",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Coconut",
  description: "Measure how language models classify mathematical curvature. Inspect every task, answer, and score.",
  icons: { icon: "/coconut.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={helveticaNeue.variable}>
      <body>{children}</body>
    </html>
  );
}
