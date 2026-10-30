import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";
import TopBar from "./_components/TopBar";
import { isSimulation } from "@/lib/messaging/mode";

// Served by Next.js with the site (no request to Google from the browser).
// globals.css uses them through --font-body and --font-heading.
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: "Clientes Vitral",
  description: "Registo de clientes da Vitral",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Always the light look, even when the phone or computer is set to dark mode.
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${figtree.variable} ${cormorant.variable}`}>
      <body>
        <TopBar simulation={isSimulation()} />
        {children}
      </body>
    </html>
  );
}
