import type { SoundEffect } from "./types";

export async function fetchMyInstantsDirectly({
	query,
	category,
	page = 1,
}: {
	query?: string;
	category?: string;
	page?: number;
}): Promise<{ results: SoundEffect[]; count: number; next: boolean }> {
	const params = new URLSearchParams({
		provider: "myinstants",
		page: page.toString(),
	});

	if (query && query.trim()) {
		params.set("q", query.trim());
	}

	if (category && category !== "all") {
		params.set("category", category);
	}

	const response = await fetch(`/api/sounds/search?${params.toString()}`);

	if (!response.ok) {
		const errorData = await response.json().catch(() => null);
		throw new Error(
			errorData?.message ||
				errorData?.error ||
				`Myinstants API error: ${response.status}`,
		);
	}

	const data = await response.json();
	return {
		results: (data.results as SoundEffect[]) || [],
		count: data.count || 0,
		next: Boolean(data.next),
	};
}
