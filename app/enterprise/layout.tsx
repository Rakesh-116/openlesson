import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Sales Training Software - Train Reps to Think, Not Memorize | openLesson",
  description:
    "AI-powered sales training that detects knowledge gaps. Reps explain products verbally, AI finds what they don't understand. Better than scripts.",
  keywords: [
    "AI sales training",
    "sales enablement software",
    "product knowledge training",
    "sales rep training tool",
    "AI for sales teams",
    "sales onboarding software",
    "knowledge gap detection",
  ],
  openGraph: {
    title: "AI Sales Training Software | openLesson",
    description:
      "Train sales reps to truly understand your product. AI listens to their explanations and detects knowledge gaps before customers do.",
    url: "https://openlesson.academy/enterprise",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Sales Training Software | openLesson",
    description:
      "Train sales reps to truly understand your product. AI detects knowledge gaps before customers do.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/enterprise",
  },
};

export default function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
