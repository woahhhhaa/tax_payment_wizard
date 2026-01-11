import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata = {
  title: "Tax Payment Wizard SaaS",
  description: "Tax payment workflow for accounting teams."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
