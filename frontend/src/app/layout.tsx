import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/WagmiProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CipherBook — Encrypted Limit Order Book DEX",
  description:
    "The first fully encrypted CLOB DEX on Zama's fhEVM. Private trading that eliminates front-running and MEV.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-950 text-white font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
