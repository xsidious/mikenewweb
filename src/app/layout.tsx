import type { Metadata } from "next";
import { Bebas_Neue, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "ASAP — Precision Detailing",
  description:
    "From damaged paint to factory finish. Cinematic precision detailing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${bebas.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
