import { type NextRequest, NextResponse } from "next/server";
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
			Object.fromEntries(response.headers.entries()),
		);

		let data: Record<string, unknown> | null = null;

		if (response.ok) {
			data = await response.json();
		} else {
			const errorText = await response.text();
			console.warn(`twitterpicker returned ${response.status}: ${errorText.slice(0, 100)}... Attempting TikWM fallback.`);
			
			// Fallback to TikWM API
			const tikwmUrl = `https://www.tikwm.com/api/?url=https://www.tiktok.com/video/${videoId}`;
			const tikwmRes = await fetch(tikwmUrl, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			});

			if (tikwmRes.ok) {
				const tikwmData = await tikwmRes.json();
				if (tikwmData.code === 0 && tikwmData.data?.play) {
					data = {
						video_no_watermark: {
							url: tikwmData.data.play,
						},
						cover: tikwmData.data.cover,
						title: tikwmData.data.title,
					};
				}
			}
		}

		if (!data || (!data.video_no_watermark && !data.url)) {
			throw new Error(`Failed to fetch TikTok video from all sources (Primary HTTP ${response.status})`);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("=== Error in TikTok API Route ===");
		console.error(
			"Error type:",
			error instanceof Error ? error.constructor.name : typeof error,
		);
		console.error(
			"Error message:",
			error instanceof Error ? error.message : String(error),
		);
		console.error("Error stack:", error instanceof Error ? error.stack : "N/A");

		return NextResponse.json(
			{
				error:
					"Failed to fetch video" +
					(error instanceof Error ? ": " + error.message : ""),
			},
			{ status: 500 },
		);
	}
}
