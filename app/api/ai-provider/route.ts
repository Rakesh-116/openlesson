import { NextResponse } from "next/server";
import { getProviderInfo, getAvailableModels } from "@/lib/ai-provider";

/**
 * GET /api/ai-provider
 * Returns the active AI provider configuration.
 * Used by the admin dashboard to display provider status.
 */
export async function GET() {
  try {
    const info = getProviderInfo();
    const models = getAvailableModels();

    return NextResponse.json({
      ...info,
      availableModels: models,
    });
  } catch (error) {
    console.error("Error fetching AI provider info:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider info" },
      { status: 500 }
    );
  }
}
