import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PlanView } from "@/components/PlanView";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPlanMeta(planId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });

  const { data } = await supabase
    .from("learning_plans")
    .select("title, root_topic, cover_image_url, profiles:author_id(username)")
    .eq("id", planId)
    .single();

  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const plan = await getPlanMeta(id);

  if (!plan) {
    return { title: "Plan - openLesson" };
  }

  const title = plan.title || plan.root_topic || "Learning Plan";
  const profiles = plan.profiles as any;
  const author = profiles?.username;
  const description = author
    ? `A learning plan by @${author} on openLesson`
    : "A learning plan on openLesson";

  const images = plan.cover_image_url
    ? [{ url: plan.cover_image_url, width: 1200, height: 630, alt: title }]
    : [{ url: "/og-default.jpg", width: 1024, height: 536, alt: title }];

  return {
    title: `${title} - openLesson`,
    description,
    openGraph: {
      title: `${title} - openLesson`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - openLesson`,
      description,
      images: images.map(i => i.url),
    },
  };
}

export default function PlanPage() {
  return <PlanView />;
}
