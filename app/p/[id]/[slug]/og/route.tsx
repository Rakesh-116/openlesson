import { ImageResponse } from "next/og";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; slug: string }> }
) {
  const { id, slug } = await params;
  const { searchParams } = new URL(request.url);
  const titleParam = searchParams.get("title");
  const authorParam = searchParams.get("author");

  const title = titleParam ? decodeURIComponent(titleParam) : (decodeURIComponent(slug) || "Learning Plan");
  const author = authorParam ? decodeURIComponent(authorParam) : "openLesson";

  const image = new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: "4px",
              background: "linear-gradient(90deg, #22c55e, #3b82f6, #8b5cf6)",
              width: "100%",
            }}
          />
          <div
            style={{
              flex: 1,
              backgroundImage: `
                linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <div
                style={{
                  fontSize: "18px",
                  color: "#22c55e",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                openLesson
              </div>
            </div>

            <div
              style={{
                fontSize: "56px",
                color: "white",
                fontWeight: 700,
                lineHeight: 1.15,
                maxWidth: "900px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "22px",
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#737373"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    color: "#737373",
                    fontWeight: 500,
                  }}
                >
                  Created by
                </div>
                <div
                  style={{
                    fontSize: "22px",
                    color: "#e5e5e5",
                    fontWeight: 600,
                  }}
                >
                  @{author}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                borderRadius: "20px",
                border: "1px solid rgba(34, 197, 94, 0.25)",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "4px",
                  backgroundColor: "#22c55e",
                }}
              />
              <div
                style={{
                  fontSize: "14px",
                  color: "#22c55e",
                  fontWeight: 600,
                }}
              >
                Public Plan
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );

  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
