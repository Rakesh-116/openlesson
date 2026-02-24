import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "openLesson",
  description: "AI-powered tutoring that listens to you reason and asks the right questions at the right time.",
  metadataBase: new URL("https://openlesson.academy"),
  openGraph: {
    title: "openLesson",
    description: "An AI tutor that listens to you reason and asks questions when it spots gaps in your reasoning. Free and open source.",
    url: "https://openlesson.academy",
    siteName: "openLesson",
    images: [
      {
        url: "/og-default.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson. AI-powered tutoring for problem solving.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "openLesson",
    description: "An AI tutor that listens to you reason and asks questions when it spots gaps in your reasoning.",
    images: ["/og-default.jpg"],
    creator: "@uncertainsys",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
