import { useEffect, useState } from "react";
import { useSoundsStore } from "@/stores/sounds-store";
import { fetchMyInstantsDirectly } from "@/lib/sounds/myinstants-client";

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

export function useSoundSearch({
	query,
	commercialOnly,
}: {
	query: string;
	commercialOnly: boolean;
}) {
	const {
		searchResults,
		isSearching,
		searchError,
		lastSearchQuery,
		currentPage,
		hasNextPage,
		isLoadingMore,
		totalCount,
		setSearchResults,
		setSearching,
		setSearchError,
		setLastSearchQuery,
		setCurrentPage,
		setHasNextPage,
		setTotalCount,
		setLoadingMore,
		appendSearchResults,
		appendTopSounds,
		resetPagination,
		searchProvider,
		selectedCategory,
	} = useSoundsStore();

	const debouncedQuery = useDebounce(query, 300);

	const loadMore = async () => {
		if (isLoadingMore || !hasNextPage) return;

		try {
			setLoadingMore({ loading: true });
			const nextPage = currentPage + 1;

			let data;
			if (searchProvider === "myinstants") {
				data = await fetchMyInstantsDirectly({
					query: debouncedQuery.trim(),
					category: selectedCategory,
					page: nextPage,
				});
			} else {
				const searchParams = new URLSearchParams({
					page: nextPage.toString(),
					type: "effects",
					provider: searchProvider,
				});

				if (debouncedQuery.trim()) {
					searchParams.set("q", debouncedQuery);
				}

				if (selectedCategory) {
					searchParams.set("category", selectedCategory);
				}

				searchParams.set("commercial_only", commercialOnly.toString());
				const response = await fetch(
					`/api/sounds/search?${searchParams.toString()}`,
				);

				if (!response.ok) {
					setSearchError({ error: `Load more failed: ${response.status}` });
					setLoadingMore({ loading: false });
					return;
				}
				data = await response.json();
			}

			if (debouncedQuery.trim()) {
				appendSearchResults({ results: data.results });
			} else {
				appendTopSounds({ results: data.results });
			}

			setCurrentPage({ page: nextPage });
			setHasNextPage({ hasNext: !!data.next });
			setTotalCount({ count: data.count || data.results?.length || 0 });
		} catch (err) {
			setSearchError({
				error: err instanceof Error ? err.message : "Load more failed",
			});
		} finally {
			setLoadingMore({ loading: false });
		}
	};

	useEffect(() => {
		if (!debouncedQuery.trim()) {
			setSearchResults({ results: [] });
			setSearchError({ error: null });
			setLastSearchQuery({ query: "" });
			return;
		}

		if (debouncedQuery === lastSearchQuery && searchResults.length > 0) {
			return;
		}

		let ignore = false;

		const fetchSearch = async () => {
			try {
				setSearching({ searching: true });
				setSearchError({ error: null });
				resetPagination();

				let data;
				if (searchProvider === "myinstants") {
					data = await fetchMyInstantsDirectly({
						query: debouncedQuery.trim(),
						category: selectedCategory,
						page: 1,
					});
				} else {
					const response = await fetch(
						`/api/sounds/search?q=${encodeURIComponent(debouncedQuery)}&type=effects&page=1&provider=${searchProvider}&category=${encodeURIComponent(selectedCategory)}`,
					);

					if (ignore) return;

					if (!response.ok) {
						setSearchError({ error: `Search failed: ${response.status}` });
						setSearching({ searching: false });
						return;
					}
					data = await response.json();
				}

				if (!ignore && data) {
					setSearchResults({ results: data.results });
					setLastSearchQuery({ query: debouncedQuery });
					setHasNextPage({ hasNext: !!data.next });
					setTotalCount({ count: data.count || data.results?.length || 0 });
					setCurrentPage({ page: 1 });
				}
			} catch (err) {
				if (!ignore) {
					setSearchError({
						error: err instanceof Error ? err.message : "Search failed",
					});
				}
			} finally {
				if (!ignore) {
					setSearching({ searching: false });
				}
			}
		};

		fetchSearch();

		return () => {
			ignore = true;
		};
	}, [
		debouncedQuery,
		lastSearchQuery,
		searchResults.length,
		setSearchResults,
		setSearching,
		setSearchError,
		setLastSearchQuery,
		setCurrentPage,
		setHasNextPage,
		setTotalCount,
		resetPagination,
		searchProvider,
		selectedCategory,
	]);

	return {
		results: searchResults,
		isLoading: isSearching,
		error: searchError,
		loadMore,
		hasNextPage,
		isLoadingMore,
		totalCount,
	};
}
