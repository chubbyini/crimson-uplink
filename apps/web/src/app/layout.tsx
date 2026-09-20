import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AuthButton from "@/components/AuthButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crimson Uplink",
  description: "Sources → idea bank → drafter → approval → publish",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            <span className="text-red-700">CRIMSON</span> UPLINK
          </Link>
          <AuthButton />
        </header>
        {children}
      </body>
    </html>
  );
}
