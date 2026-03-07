import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - AI Tutor Plans | openLesson",
  description:
    "Start free, upgrade when ready. AI tutoring from $4.99/month. Open source - self-host for free.",
  keywords: [
    "AI tutor pricing",
    "learning platform cost",
    "AI tutoring subscription",
    "educational AI pricing",
    "open source AI tutor",
  ],
  openGraph: {
    title: "Pricing - AI Tutor Plans | openLesson",
    description:
      "Start free, upgrade when ready. AI tutoring from $4.99/month. Open source - self-host for free.",
    url: "https://openlesson.academy/pricing",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | openLesson",
    description:
      "Start free, upgrade when ready. AI tutoring from $4.99/month.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
