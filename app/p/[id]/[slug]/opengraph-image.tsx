import { ImageResponse } from "next/og";

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

function formatTitle(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded
    .replace(/-/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function Image({ params }: ImageProps) {
  const { slug } = await params;
  const title = formatTitle(slug) || "Learning Plan";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient orbs */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            borderRadius: "300px",
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "200px",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)",
          }}
        />

        {/* Top gradient bar */}
        <div
          style={{
            height: "4px",
            width: "100%",
            background: "linear-gradient(90deg, #22c55e, #3b82f6, #8b5cf6)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 80px",
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontSize: "20px",
              color: "#22c55e",
              fontWeight: 600,
              marginBottom: "32px",
            }}
          >
            openLesson
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "56px",
              color: "white",
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: "900px",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 80px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "20px",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
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

          <div
            style={{
              fontSize: "16px",
              color: "#525252",
              fontWeight: 500,
            }}
          >
            openLesson.academy
          </div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    }
  );
}
