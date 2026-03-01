import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Learning Plan";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

interface ImageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

async function getAuthorUsername(planId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return "openLesson";
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/learning_plans?id=eq.${planId}&is_public=eq.true&select=author_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const data = await response.json();
    if (!data || data.length === 0 || !data[0]?.author_id) {
      return "openLesson";
    }

    const authorId = data[0].author_id;

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${authorId}&select=username`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const profileData = await profileResponse.json();
    if (profileData && profileData.length > 0 && profileData[0]?.username) {
      return profileData[0].username;
    }

    return "openLesson";
  } catch (error) {
    console.error("Error fetching author:", error);
    return "openLesson";
  }
}

export default async function Image({ params }: ImageProps) {
  const { id, slug } = await params;

  const decodedSlug = decodeURIComponent(slug);
  const title = decodedSlug || "Learning Plan";

  const authorUsername = await getAuthorUsername(id);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0a0a0a",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              color: "#22c55e",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            openLesson
          </div>
          <div
            style={{
              fontSize: "64px",
              color: "white",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: "900px",
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "20px",
              background: "#262626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a3a3a3"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#a3a3a3",
              fontWeight: 500,
            }}
          >
            @{authorUsername}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
