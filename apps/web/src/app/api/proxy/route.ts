import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const targetUrl = searchParams.get("url");

		if (!targetUrl) {
			return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
		}

		const urlObj = new URL(targetUrl);
		if (
			urlObj.hostname !== "www.myinstants.com" &&
			urlObj.hostname !== "myinstants.com"
		) {
			return NextResponse.json({ error: "Forbidden domain" }, { status: 403 });
		}

		const response = await fetch(targetUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: `Failed to fetch target: ${response.statusText}` },
				{ status: response.status },
			);
		}

		const arrayBuffer = await response.arrayBuffer();
		const contentType = response.headers.get("content-type") || "audio/mpeg";

		return new Response(arrayBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Proxy error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
