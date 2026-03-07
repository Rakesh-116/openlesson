import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Technical Assessment Tool for Hiring | openLesson",
  description:
    "Evaluate candidates through conversation, not multiple choice. AI detects real understanding of coding, system design, and technical concepts.",
  keywords: [
    "AI hiring assessment",
    "technical interview tool",
    "candidate evaluation software",
    "AI for recruiting",
    "skills assessment platform",
    "technical screening tool",
    "coding assessment AI",
  ],
  openGraph: {
    title: "AI Technical Assessment Tool for Hiring | openLesson",
    description:
      "Evaluate candidates through conversation, not multiple choice. AI detects real understanding of technical concepts.",
    url: "https://openlesson.academy/eval",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Technical Assessment Tool for Hiring | openLesson",
    description:
      "Evaluate candidates through conversation. AI detects real understanding of coding and system design.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/eval",
  },
};

export default function EvalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
