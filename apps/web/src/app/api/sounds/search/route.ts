import { webEnv } from "@/lib/env/web";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const searchParamsSchema = z.object({
	q: z.string().max(500, "Query too long").optional(),
	type: z.enum(["songs", "effects"]).optional(),
	page: z.coerce.number().int().min(1).max(1000).default(1),
	page_size: z.coerce.number().int().min(1).max(150).default(20),
	sort: z
		.enum(["downloads", "rating", "created", "score"])
		.default("downloads"),
	min_rating: z.coerce.number().min(0).max(5).default(3),
	commercial_only: z.coerce.boolean().default(true),
	provider: z.enum(["freesound", "myinstants"]).default("freesound"),
	category: z.string().optional(),
});

const freesoundResultSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string(),
	url: z.string().url(),
	previews: z
		.object({
			"preview-hq-mp3": z.string().url(),
			"preview-lq-mp3": z.string().url(),
			"preview-hq-ogg": z.string().url(),
			"preview-lq-ogg": z.string().url(),
		})
		.optional(),
	download: z.string().url().optional(),
	duration: z.number(),
	filesize: z.number(),
	type: z.string(),
	channels: z.number(),
	bitrate: z.number(),
	bitdepth: z.number(),
	samplerate: z.number(),
	username: z.string(),
	tags: z.array(z.string()),
	license: z.string(),
	created: z.string(),
	num_downloads: z.number().optional(),
	avg_rating: z.number().optional(),
	num_ratings: z.number().optional(),
});

const freesoundResponseSchema = z.object({
	count: z.number(),
	next: z.string().url().nullable(),
	previous: z.string().url().nullable(),
	results: z.array(freesoundResultSchema),
});

const transformedResultSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string(),
	url: z.string(),
	previewUrl: z.string().optional(),
	downloadUrl: z.string().optional(),
	duration: z.number(),
	filesize: z.number(),
	type: z.string(),
	channels: z.number(),
	bitrate: z.number(),
	bitdepth: z.number(),
	samplerate: z.number(),
	username: z.string(),
	tags: z.array(z.string()),
	license: z.string(),
	created: z.string(),
	downloads: z.number().optional(),
	rating: z.number().optional(),
	ratingCount: z.number().optional(),
});

const apiResponseSchema = z.object({
	count: z.number(),
	next: z.string().nullable(),
	previous: z.string().nullable(),
	results: z.array(transformedResultSchema),
	query: z.string().optional(),
	type: z.string(),
	page: z.number(),
	pageSize: z.number(),
	sort: z.string(),
	minRating: z.number().optional(),
});

function buildSortParameter({ query, sort }: { query?: string; sort: string }) {
	if (!query) return `${sort}_desc`;
	return sort === "score" ? "score" : `${sort}_desc`;
}

function applyEffectsFilters({
	params,
	min_rating,
	commercial_only,
}: {
	params: URLSearchParams;
	min_rating: number;
	commercial_only: boolean;
}) {
	params.append("filter", "duration:[* TO 30.0]");
	params.append("filter", `avg_rating:[${min_rating} TO *]`);

	if (commercial_only) {
		params.append(
			"filter",
			'license:("Attribution" OR "Creative Commons 0" OR "Attribution Noncommercial" OR "Attribution Commercial")',
		);
	}

	params.append(
		"filter",
		"tag:sound-effect OR tag:sfx OR tag:foley OR tag:ambient OR tag:nature OR tag:mechanical OR tag:electronic OR tag:impact OR tag:whoosh OR tag:explosion",
	);
}

function transformFreesoundResult(
	result: z.infer<typeof freesoundResultSchema>,
) {
	return {
		id: result.id,
		name: result.name,
		description: result.description,
		url: result.url,
		previewUrl:
			result.previews?.["preview-hq-mp3"] ||
			result.previews?.["preview-lq-mp3"],
		downloadUrl: result.download,
		duration: result.duration,
		filesize: result.filesize,
		type: result.type,
		channels: result.channels,
		bitrate: result.bitrate,
		bitdepth: result.bitdepth,
		samplerate: result.samplerate,
		username: result.username,
		tags: result.tags,
		license: result.license,
		created: result.created,
		downloads: result.num_downloads || 0,
		rating: result.avg_rating || 0,
		ratingCount: result.num_ratings || 0,
	};
}

function decodeHTMLEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'");
}

function getHashNumber(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return Math.abs(hash);
}

async function searchMyInstants({
	query,
	category,
	page,
}: {
	query?: string;
	category?: string;
	page: number;
}) {
	let url: string;
	if (query) {
		url = `https://www.myinstants.com/en/search/?name=${encodeURIComponent(query)}&page=${page}`;
	} else if (category && category !== "trending") {
		let myinstantsCat = category;
		if (category === "anime") myinstantsCat = "anime & manga";
		else if (category === "funny") myinstantsCat = "pranks";
		else if (category === "tiktok") myinstantsCat = "tiktok trends";
		else if (category === "movies") myinstantsCat = "movies";
		url = `https://www.myinstants.com/en/categories/${encodeURIComponent(myinstantsCat)}/?page=${page}`;
	} else {
		url = `https://www.myinstants.com/en/index/vn/?page=${page}`;
	}

	const response = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.5",
			"Upgrade-Insecure-Requests": "1",
			"Sec-Fetch-Dest": "document",
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "none",
			"Sec-Fetch-User": "?1",
			"Cache-Control": "max-age=0",
		},
	});

	if (!response.ok) {
		throw new Error(`Myinstants returned status ${response.status}`);
	}

	const html = await response.text();
	const results: any[] = [];
	const regex = /<div class="instant">[\s\S]*?onclick="play\('([^']+)'[^)]*\)[\s\S]*?class="[^"]*instant-link[^"]*">([^<]+)<\/a>/g;

	let match;
	while ((match = regex.exec(html)) !== null) {
		const mp3Path = match[1];
		const rawName = match[2].trim();
		const name = decodeHTMLEntities(rawName);
		const id = getHashNumber(mp3Path || name);
		
		const previewUrl = mp3Path.startsWith("http")
			? mp3Path
			: `https://www.myinstants.com${mp3Path}`;

		results.push({
			id,
			name,
			description: `Myinstants sound effect: ${name}`,
			url: previewUrl,
			previewUrl,
			downloadUrl: previewUrl,
			duration: 5.0,
			filesize: 0,
			type: "audio",
			channels: 2,
			bitrate: 128,
			bitdepth: 16,
			samplerate: 44100,
			username: "MyInstants",
			tags: [query || "trending", "myinstants"],
			license: "Unknown",
			created: new Date().toISOString(),
			downloads: 0,
			rating: 5,
			ratingCount: 1,
		});
	}

	return results;
}

export async function GET(request: NextRequest) {
	try {
		const { limited } = await checkRateLimit({ request });
		if (limited) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}

		const { searchParams } = new URL(request.url);

		const validationResult = searchParamsSchema.safeParse({
			q: searchParams.get("q") || undefined,
			type: searchParams.get("type") || undefined,
			page: searchParams.get("page") || undefined,
			page_size: searchParams.get("page_size") || undefined,
			sort: searchParams.get("sort") || undefined,
			min_rating: searchParams.get("min_rating") || undefined,
			provider: searchParams.get("provider") || undefined,
			category: searchParams.get("category") || undefined,
		});

		if (!validationResult.success) {
			return NextResponse.json(
				{
					error: "Invalid parameters",
					details: validationResult.error.flatten().fieldErrors,
				},
				{ status: 400 },
			);
		}

		const {
			q: query,
			type,
			page,
			page_size: pageSize,
			sort,
			min_rating,
			commercial_only,
			provider,
			category,
		} = validationResult.data;

		if (type === "songs") {
			return NextResponse.json(
				{
					error: "Songs are not available yet",
					message:
						"Song search functionality is coming soon. Try searching for sound effects instead.",
				},
				{ status: 501 },
			);
		}

		if (provider === "myinstants") {
			try {
				const results = await searchMyInstants({ query, category, page });
				const hasNext = results.length === 36;
				
				const categoryQueryParam = category ? `&category=${encodeURIComponent(category)}` : "";
				
				const responseData = {
					count: hasNext ? (page + 1) * 36 : page * 36,
					next: hasNext
						? `/api/sounds/search?q=${encodeURIComponent(query || "")}&page=${page + 1}&provider=myinstants${categoryQueryParam}`
						: null,
					previous:
						page > 1
							? `/api/sounds/search?q=${encodeURIComponent(query || "")}&page=${page - 1}&provider=myinstants${categoryQueryParam}`
							: null,
					results,
					query: query || "",
					type: "effects",
					page,
					pageSize: 36,
					sort: "downloads",
				};

				const responseValidation = apiResponseSchema.safeParse(responseData);
				if (!responseValidation.success) {
					console.error(
						"Invalid Myinstants API response structure:",
						responseValidation.error,
					);
					return NextResponse.json(
						{ error: "Internal response formatting error" },
						{ status: 500 },
					);
				}

				return NextResponse.json(responseValidation.data);
			} catch (myInstantsError) {
				
				console.warn(
					"MyInstants search failed/blocked (falling back to Freesound):",
					myInstantsError,
				);
				// Fall through to Freesound
			}
		}

		const baseUrl = "https://freesound.org/apiv2/search/text/";

		const sortParam = buildSortParameter({ query, sort });

		const params = new URLSearchParams({
			query: query || "",
			token: webEnv.FREESOUND_API_KEY,
			page: page.toString(),
			page_size: pageSize.toString(),
			sort: sortParam,
			fields:
				"id,name,description,url,previews,download,duration,filesize,type,channels,bitrate,bitdepth,samplerate,username,tags,license,created,num_downloads,avg_rating,num_ratings",
		});

		const isEffectsSearch = type === "effects" || !type;
		if (isEffectsSearch) {
			applyEffectsFilters({ params, min_rating, commercial_only });
		}

		if (category && category !== "trending") {
			let freesoundTag = category;
			if (category === "tiktok") freesoundTag = "viral";
			else if (category === "movies") freesoundTag = "movie";
			params.append("filter", `tag:${freesoundTag}`);
		}

		const response = await fetch(`${baseUrl}?${params.toString()}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Freesound API error:", response.status, errorText);
			return NextResponse.json(
				{ error: "Failed to search sounds" },
				{ status: response.status },
			);
		}

		const rawData = await response.json();

		const freesoundValidation = freesoundResponseSchema.safeParse(rawData);
		if (!freesoundValidation.success) {
			console.error(
				"Invalid Freesound API response:",
				freesoundValidation.error,
			);
			return NextResponse.json(
				{ error: "Invalid response from Freesound API" },
				{ status: 502 },
			);
		}

		const data = freesoundValidation.data;

		const transformedResults = data.results.map(transformFreesoundResult);

		const responseData = {
			count: data.count,
			next: data.next,
			previous: data.previous,
			results: transformedResults,
			query: query || "",
			type: type || "effects",
			page,
			pageSize,
			sort,
			minRating: min_rating,
		};

		const responseValidation = apiResponseSchema.safeParse(responseData);
		if (!responseValidation.success) {
			console.error(
				"Invalid API response structure:",
				responseValidation.error,
			);
			return NextResponse.json(
				{ error: "Internal response formatting error" },
				{ status: 500 },
			);
		}

		return NextResponse.json(responseValidation.data);
	} catch (error) {
		console.error("Error searching sounds:", error);
		const details = error instanceof Error ? error.message : String(error);
		return NextResponse.json(
			{ error: "Internal server error", details },
			{ status: 500 },
		);
	}
}
