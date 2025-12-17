import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  videoId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  console.log("=== TikTok API Route Called ===");

  try {
    const body = await request.json();
    console.log("Request body:", body);

    const { videoId } = requestSchema.parse(body);
    console.log("Video ID:", videoId);

    const apiUrl = `https://api.twitterpicker.com/tiktok/mediav2?id=${videoId}`;
    console.log("Fetching from:", apiUrl);

    // Fetch from TikTok API with localhost origin
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Origin: "http://localhost:3000",
        Referer: "http://localhost:3000/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("API response data keys:", Object.keys(data));
    console.log("Video URL present:", !!data.video_no_watermark?.url);

    return NextResponse.json(data);
  } catch (error) {
    console.error("=== Error in TikTok API Route ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Error stack:", error instanceof Error ? error.stack : "N/A");

    return NextResponse.json(
      {
        error:
          "Failed to fetch video" +
          (error instanceof Error ? ": " + error.message : ""),
      },
      { status: 500 }
    );
  }
}
