import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getBaseUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "wildlife-blogger",
    template: "%s · wildlife-blogger"
  },
  description:
    "AI-assisted research and blog generation to help wildlife conservation organizations educate, engage, and get discovered.",
  alternates: { canonical: "/" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

