import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - openLesson",
  description: "openLesson is an AI-powered tutor that listens to you reason and asks guiding questions when it spots gaps. Built by Daniel Colomer of Uncertain Systems.",
  openGraph: {
    title: "About openLesson",
    description: "An AI tutor that listens to you reason and asks questions when it spots gaps. Open source, built on guided questioning.",
    url: "https://openlesson.academy/about",
    siteName: "openLesson",
    type: "website",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
