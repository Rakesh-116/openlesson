/**
 * Plan Cover Image Generation
 * Uses OpenRouter's Gemini Nano Banana (google/gemini-2.5-flash-image-preview)
 * to generate cinematic cover images for learning plans.
 */

import { getChatApiKey } from "@/lib/ai-provider";

const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Generate a cinematic cover image for a learning plan.
 * Returns base64-encoded PNG data (without the data URL prefix).
 */
export async function generatePlanCoverImage(description: string): Promise<{
  base64: string;
  mimeType: string;
} | null> {
  const apiKey = getChatApiKey("openrouter");

  const prompt = `Generate a cinematic, visually stunning cover image for a learning plan about: "${description}". 
The image should be atmospheric, with dramatic lighting and rich colors. Think movie poster or high-end editorial photography aesthetic. 
Wide 16:9 composition. No text, no letters, no words, no watermarks in the image.
The subject matter should visually represent the topic in an abstract or metaphorical way.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openlesson.academy",
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: "16:9",
          image_size: "1K",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation failed:", response.status, errorText);
      return null;
    }

    const result = await response.json();

    const message = result.choices?.[0]?.message;
    if (!message?.images?.length) {
      console.error("No images in response:", JSON.stringify(result).slice(0, 500));
      return null;
    }

    const imageUrl = message.images[0].image_url?.url;
    if (!imageUrl || !imageUrl.startsWith("data:")) {
      console.error("Invalid image URL format");
      return null;
    }

    // Parse data URL: "data:image/png;base64,<base64data>"
    const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      console.error("Could not parse base64 data URL");
      return null;
    }

    return {
      mimeType: match[1],
      base64: match[2],
    };
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

/**
 * Upload a plan cover image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadPlanCover(
  supabase: { storage: { from: (bucket: string) => { upload: Function; getPublicUrl: Function } } },
  userId: string,
  planId: string,
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  try {
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const path = `${userId}/${planId}.${ext}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    const { error } = await supabase.storage
      .from("plan-covers")
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("plan-covers")
      .getPublicUrl(path);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
}

/**
 * Generate and upload a cover image for a plan.
 * Updates the plan's cover_image_url in the database.
 * This is designed to be called as a fire-and-forget async operation.
 */
export async function generateAndStorePlanCover(
  supabase: {
    storage: { from: (bucket: string) => { upload: Function; getPublicUrl: Function } };
    from: (table: string) => { update: Function };
  },
  userId: string,
  planId: string,
  description: string
): Promise<string | null> {
  const imageData = await generatePlanCoverImage(description);
  if (!imageData) return null;

  const publicUrl = await uploadPlanCover(
    supabase,
    userId,
    planId,
    imageData.base64,
    imageData.mimeType
  );

  if (!publicUrl) return null;

  // Update the plan record
  await (supabase.from("learning_plans") as any)
    .update({ cover_image_url: publicUrl })
    .eq("id", planId);

  return publicUrl;
}
