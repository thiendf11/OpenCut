import type { SoundEffect } from "./types";

function decodeHTMLEntities(text: string) {
	const textArea = document.createElement("textarea");
	textArea.innerHTML = text;
	return textArea.value;
}

function getHashNumber(str: string) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash);
}

export async function fetchMyInstantsDirectly({
	query,
	category,
	page = 1,
}: {
	query?: string;
	category?: string;
	page?: number;
}): Promise<{ results: SoundEffect[]; count: number; next: boolean }> {
	if (page > 1) {
		return { results: [], count: 0, next: false };
	}

	let endpoint = "search";
	const params = new URLSearchParams();

	const exactEndpoints = [
		"trending",
		"best",
		"recent",
		"uploaded",
		"favorites",
		"detail",
	];

	if (query) {
		endpoint = "search";
		params.append("q", query);
	} else if (category && exactEndpoints.includes(category)) {
		endpoint = category;
		if (category === "trending" || category === "best") {
			params.append("q", "vn");
		}
	} else if (category) {
		endpoint = "search";
		let myinstantsCat = category;
		if (category === "anime") myinstantsCat = "anime";
		else if (category === "funny") myinstantsCat = "prank";
		else if (category === "tiktok") myinstantsCat = "tiktok";
		else if (category === "movies") myinstantsCat = "movie";
		params.append("q", myinstantsCat);
	} else {
		endpoint = "trending";
		params.append("q", "vn");
	}

	const url = `https://myinstants-api.vercel.app/${endpoint}?${params.toString()}`;
	
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Myinstants API error: ${response.status}`);
	}

	const data = await response.json();
	let dataList = [];
	if (Array.isArray(data.data)) {
		dataList = data.data;
	} else if (data.data) {
		dataList = [data.data];
	}

	const results = dataList.map((item: any) => {
		const rawName = item.title || "";
		const name = decodeHTMLEntities(rawName);
		const id = getHashNumber(item.id || item.mp3 || name);
		const previewUrl = item.mp3;

		return {
			id,
			name,
			description: item.description || `Myinstants sound effect: ${name}`,
			url: item.url || previewUrl,
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
			tags: [query || category || "trending", "myinstants"],
			license: "Unknown",
			created: new Date().toISOString(),
			downloads: 0,
			rating: 5,
			ratingCount: 1,
		} as SoundEffect;
	});

	return {
		results,
		count: results.length,
		next: false,
	};
}
