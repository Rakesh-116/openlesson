import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tutor for Classrooms - Student Understanding Assessment | openLesson",
  description:
    "AI classroom tool that listens to students explain concepts. Teachers see exactly where each student struggles. Works for math, science, English.",
  keywords: [
    "AI classroom tool",
    "AI for teachers",
    "student assessment software",
    "AI tutor for schools",
    "formative assessment AI",
    "classroom learning tool",
    "student understanding assessment",
  ],
  openGraph: {
    title: "AI Tutor for Classrooms | openLesson",
    description:
      "AI classroom tool that listens to students explain concepts. Teachers see exactly where each student struggles.",
    url: "https://openlesson.academy/schools",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Tutor for Classrooms | openLesson",
    description:
      "AI that listens to students explain concepts. Teachers see exactly where each student struggles.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/schools",
  },
};

export default function SchoolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
