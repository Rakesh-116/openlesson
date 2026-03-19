import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DemoBanner } from "@/components/DemoBanner";
import { CoachingMain } from "@/components/CoachingMain";

export const metadata = {
  title: "Coaching - openLesson",
  description: "Learn to think through anything. 1-on-1 coaching on solving the hardest problems in math, physics, and beyond — no shortcuts, just thinking. $199.",
  openGraph: {
    title: "Learn to think through anything",
    description: "1-on-1 problem solving coaching. From competition math to quantum physics — build the thinking skills to tackle any problem. $199 session.",
    url: "https://openlesson.academy/coaching",
    siteName: "openLesson",
    images: [
      {
        url: "/coaching-og.jpg",
        width: 1024,
        height: 536,
        alt: "openLesson — Learn to think through anything. 1-on-1 problem solving coaching.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn to think through anything",
    description: "1-on-1 coaching on solving the hardest problems — math, physics, and beyond. Live problem-solving streams since 2019. $199.",
    images: ["/coaching-og.jpg"],
    creator: "@uncertainsys",
  },
};

export default function CoachingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />
      <CoachingMain />
      <Footer />
    </main>
  );
}
