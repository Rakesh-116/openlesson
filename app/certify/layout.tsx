import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Certification Prep - AWS, PMP, CompTIA & More | openLesson",
  description:
    "Prepare for professional certifications with AI that tests real understanding. AWS, Azure, GCP, PMP, CompTIA, CISSP and more.",
  keywords: [
    "certification prep AI",
    "AWS exam prep",
    "PMP study tool",
    "CompTIA certification prep",
    "AI certification training",
    "cloud certification prep",
    "professional certification AI",
    "CISSP study tool",
  ],
  openGraph: {
    title: "AI Certification Prep - AWS, PMP, CompTIA & More | openLesson",
    description:
      "Prepare for professional certifications with AI that tests real understanding. AWS, Azure, GCP, PMP, CompTIA, CISSP.",
    url: "https://openlesson.academy/certify",
    siteName: "openLesson",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Certification Prep | openLesson",
    description:
      "Prepare for AWS, PMP, CompTIA and more with AI that tests real understanding, not just memorization.",
    creator: "@uncertainsys",
  },
  alternates: {
    canonical: "https://openlesson.academy/certify",
  },
};

export default function CertifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
