import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic API v2 Specification (Draft) - OpenLesson",
  description: "Comprehensive specification for the OpenLesson Agentic API v2, enabling external AI agents to act as tutors using OpenLesson's educational intelligence.",
  openGraph: {
    title: "Agentic API v2 Specification (Draft)",
    description: "Enable AI agents to leverage OpenLesson's tutoring intelligence with cryptographic proof verification.",
    url: "https://openlesson.academy/docs/agentic-v2-draft",
    siteName: "OpenLesson",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
