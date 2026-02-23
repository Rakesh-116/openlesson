import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/models?limit=100", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter models API error:", response.status, errorText);
      return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
    }

    const data = await response.json();

    const models = (data.data || [])
      .filter((m: { architecture?: { modality?: string } }) => {
        return m.architecture?.modality?.includes("text");
      })
      .slice(0, 50)
      .map((m: { id: string; name?: string; description?: string }) => ({
        id: m.id,
        label: m.name || m.id,
        description: m.description?.slice(0, 100) || "",
      }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Fetch models error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
