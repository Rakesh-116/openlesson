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
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient orbs - larger and more prominent */}
        <div
          style={{
            position: "absolute",
            top: "-300px",
            right: "-200px",
            width: "700px",
            height: "700px",
            borderRadius: "350px",
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-200px",
            left: "-150px",
            width: "500px",
            height: "500px",
            borderRadius: "250px",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "60%",
            width: "300px",
            height: "300px",
            borderRadius: "150px",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 60%)",
          }}
        />

        {/* Top gradient bar */}
        <div
          style={{
            height: "6px",
            width: "100%",
            background: "linear-gradient(90deg, #22c55e, #3b82f6, #8b5cf6, #ec4899)",
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
              fontSize: "24px",
              color: "#22c55e",
              fontWeight: 600,
              marginBottom: "40px",
              letterSpacing: "0.02em",
            }}
          >
            openLesson
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "60px",
              color: "white",
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: "900px",
              textShadow: "0 4px 30px rgba(0,0,0,0.4)",
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
            padding: "32px 80px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 20px",
              borderRadius: "24px",
              backgroundColor: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "5px",
                backgroundColor: "#22c55e",
              }}
            />
            <div
              style={{
                fontSize: "18px",
                color: "#22c55e",
                fontWeight: 600,
              }}
            >
              Public Plan
            </div>
          </div>

          <div
            style={{
              fontSize: "20px",
              color: "#a1a1aa",
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