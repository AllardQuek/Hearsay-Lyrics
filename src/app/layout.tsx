import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hearsay Lyrics | Sing C-Pop in English",
  description: "Sing your favourite Mandarin songs using English lyrics that sound just like Chinese.",
  keywords: ["C-Pop", "Mandarin", "Karaoke", "Lyrics", "Hearsay", "Gemini AI"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${outfit.variable} antialiased bg-background text-foreground transition-colors duration-300 font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
