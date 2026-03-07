import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tutor for Homeschool Families | openLesson",
  description:
    "Personalized AI tutor for homeschooling. Your child explains their thinking out loud, AI asks questions to deepen understanding. All subjects.",
  keywords: [
    "homeschool AI tutor",
    "personalized learning AI",
    "homeschool curriculum tool",
    "AI for homeschooling",
    "homeschool learning software",
    "AI tutor for kids",
    "homeschool assessment tool",
  ],
  openGraph: {
    title: "AI Tutor for Homeschool Families | openLesson",
    description:
      "Personalized AI tutor for homeschooling. Your child explains their thinking, AI asks questions to deepen understanding.",
    url: "https://openlesson.academy/homeschool",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Tutor for Homeschool Families | openLesson",
    description:
      "Personalized AI tutor for homeschooling. Your child explains their thinking, AI deepens understanding.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/homeschool",
  },
};

export default function HomeschoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
