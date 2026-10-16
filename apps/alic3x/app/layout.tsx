import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne" });

export const metadata: Metadata = {
  title: "Alic3X Voice Console — Musaix Pro",
  description: "Talk to Alic3X, the Musaix Pro studio co-pilot that drives Ableton Live.",
};

export const viewport: Viewport = { themeColor: "#09090b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${syne.variable}`}>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
