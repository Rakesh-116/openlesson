import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PlanView } from "@/components/PlanView";

interface PageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

async function getPlan(planId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: plan, error } = await supabase
    .from("learning_plans")
    .select("*, profiles:author_id(username)")
    .eq("id", planId)
    .eq("is_public", true)
    .single();

  if (error || !plan) {
    return null;
  }

  if (plan.profiles) {
    plan.author_username = plan.profiles.username;
  }

  const { data: nodes } = await supabase
    .from("plan_nodes")
    .select("*")
    .eq("plan_id", planId);

  return { plan, nodes: nodes || [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  
  const result = await getPlan(id);
  
  if (!result) {
    return {
      title: "Plan Not Found - openLesson",
    };
  }

  const { plan } = result;
  const title = plan.root_topic;
  const description = `A learning plan by @${plan.author_username || "anonymous"} on openLesson`;

  const encodedTitle = encodeURIComponent(title);
  const encodedAuthor = encodeURIComponent(plan.author_username || "anonymous");
  const ogImageUrl = `/p/${id}/${slug}/og?title=${encodedTitle}&author=${encodedAuthor}`;

  return {
    title: `${title} - openLesson`,
    description,
    openGraph: {
      title: `${title} - openLesson`,
      description,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - openLesson`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicPlanPage({ params }: PageProps) {
  const { id, slug } = await params;
  
  const result = await getPlan(id);
  
  if (!result) {
    notFound();
  }

  return <PlanView initialPlan={result.plan} initialNodes={result.nodes} />;
}
