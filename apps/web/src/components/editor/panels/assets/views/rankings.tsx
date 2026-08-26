"use client";

import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
	buildTextElement,
	buildElementFromMedia,
	buildLibraryAudioElement,
} from "@/lib/timeline/element-utils";
import { InsertElementCommand } from "@/lib/commands/timeline";
import { processMediaAssets } from "@/lib/media/processing";
import { TICKS_PER_SECOND } from "@/lib/wasm/ticks";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	PlusSignIcon,
	Delete02Icon,
	Download01Icon,
	TiktokIcon,
	YoutubeIcon,
	InstagramIcon,
	TwitterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type Platform = "tiktok" | "youtube" | "instagram" | "twitter";

interface RankingItem {
	id: string;
	rankingNumber: number;
	title: string;
	titleColor: string;
	titleBgColor: string;
	numberColor: string;
	numberBgColor: string;
	strokeColor?: string;
	strokeWidth?: number;
	titleStrokeWidth?: number;
	platform: Platform;
	videoUrl: string;
	isLoadingVideo: boolean;
	duration: number; // in seconds
	maxDuration?: number; // max duration based on video length in seconds
}

export function RankingsView() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());

	const activeProjectId = activeProject?.metadata.id;

	const [rankings, setRankings] = useState<RankingItem[]>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-items-${activeProjectId}`,
			);
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (_e) {}
			}
		}
		return [];
	});

	const [itemCount, setItemCount] = useState<number | string>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-itemcount-${activeProjectId}`,
			);
			if (saved) {
				const parsed = parseInt(saved, 10);
				if (!isNaN(parsed)) return parsed;
			}
		}
		return 5;
	});

	const [colorPickerOpen, setColorPickerOpen] = useState<{
		id: string;
		type:
			| "number"
			| "numberBg"
			| "title"
			| "titleBg"
			| "stroke"
			| `default${1 | 2 | 3}`;
	} | null>(null);

	// Default colors for top 3 rankings
	const [defaultColors, setDefaultColors] = useState<[string, string, string]>(
		() => {
			if (typeof window !== "undefined") {
				const saved = localStorage.getItem("ranking-default-colors");
				if (saved) {
					try {
						return JSON.parse(saved);
					} catch (_e) {
						// Ignore parse errors
					}
				}
			}
			return ["#FFD700", "#C0C0C0", "#CD7F32"]; // Gold, Silver, Bronze
		},
	);

	// Save to localStorage when colors change
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				"ranking-default-colors",
				JSON.stringify(defaultColors),
			);
		}
	}, [defaultColors]);

	// Map ranking ID to timeline element IDs (number, title, header, and video in separate tracks)
	const [timelineElementMap, setTimelineElementMap] = useState<
		Map<
			string,
			{
				trackId: string;
				numberId: string;
				titleId: string;
				titleTrackId: string;
				videoId?: string;
				videoTrackId?: string;
				audioId?: string;
				audioTrackId?: string;
			}
		>
	>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-map-${activeProjectId}`,
			);
			if (saved) {
				try {
					return new Map(JSON.parse(saved));
				} catch (_e) {}
			}
		}
		return new Map();
	});

	const containerRef = useRef<HTMLDivElement>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [enableTransitionSound, setEnableTransitionSound] = useState<boolean>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-sound-${activeProjectId}`,
			);
			if (saved !== null) return saved === "true";
		}
		return false;
	});
	const [globalHeader, setGlobalHeader] = useState<string>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-header-${activeProjectId}`,
			);
			if (saved !== null) return saved;
		}
		return "";
	});

	const [globalHeaderElementId, setGlobalHeaderElementId] = useState<{
		trackId: string;
		elementId: string;
	} | null>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-header-id-${activeProjectId}`,
			);
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (_e) {}
			}
		}
		return null;
	});

	const [globalSubheader, setGlobalSubheader] = useState<string>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-subheader-${activeProjectId}`,
			);
			if (saved !== null) return saved;
		}
		return "";
	});

	const [globalSubheaderElementId, setGlobalSubheaderElementId] = useState<{
		trackId: string;
		elementId: string;
	} | null>(() => {
		if (typeof window !== "undefined" && activeProjectId) {
			const saved = localStorage.getItem(
				`opencut-rankings-subheader-id-${activeProjectId}`,
			);
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (_e) {}
			}
		}
		return null;
	});

	// Hydrate and validate state from localStorage when activeProjectId or editor.timeline changes
	useEffect(() => {
		if (!activeProjectId || typeof window === "undefined") return;

		const savedRankings = localStorage.getItem(
			`opencut-rankings-items-${activeProjectId}`,
		);
		const savedMap = localStorage.getItem(
			`opencut-rankings-map-${activeProjectId}`,
		);
		const savedHeader = localStorage.getItem(
			`opencut-rankings-header-${activeProjectId}`,
		);
		const savedHeaderId = localStorage.getItem(
			`opencut-rankings-header-id-${activeProjectId}`,
		);
		const savedSubheader = localStorage.getItem(
			`opencut-rankings-subheader-${activeProjectId}`,
		);
		const savedSubheaderId = localStorage.getItem(
			`opencut-rankings-subheader-id-${activeProjectId}`,
		);
		const savedSound = localStorage.getItem(
			`opencut-rankings-sound-${activeProjectId}`,
		);
		const savedItemCount = localStorage.getItem(
			`opencut-rankings-itemcount-${activeProjectId}`,
		);

		if (savedRankings) {
			try {
				setRankings(JSON.parse(savedRankings));
			} catch (_e) {}
		}

		if (savedMap) {
			try {
				const entries = JSON.parse(savedMap);
				const map = new Map<string, any>(entries);

				// Validate entries against current timeline elements
				const validMap = new Map();
				for (const [id, info] of map.entries()) {
					const numTrack = editor.timeline.getTrackById({
						trackId: info.trackId,
					});
					const numEl = numTrack?.elements.find(
						(el) => el.id === info.numberId,
					);

					const titleTrack = editor.timeline.getTrackById({
						trackId: info.titleTrackId,
					});
					const titleEl = titleTrack?.elements.find(
						(el) => el.id === info.titleId,
					);

					if (numEl && titleEl) {
						validMap.set(id, info);
					}
				}
				setTimelineElementMap(validMap);
			} catch (_e) {}
		}

		if (savedHeader !== null) {
			setGlobalHeader(savedHeader);
		}

		if (savedHeaderId) {
			try {
				const info = JSON.parse(savedHeaderId);
				const track = editor.timeline.getTrackById({ trackId: info.trackId });
				const el = track?.elements.find((e) => e.id === info.elementId);
				if (el) {
					setGlobalHeaderElementId(info);
				} else {
					setGlobalHeaderElementId(null);
				}
			} catch (_e) {}
		}

		if (savedSubheader !== null) {
			setGlobalSubheader(savedSubheader);
		}

		if (savedSubheaderId) {
			try {
				const info = JSON.parse(savedSubheaderId);
				const track = editor.timeline.getTrackById({ trackId: info.trackId });
				const el = track?.elements.find((e) => e.id === info.elementId);
				if (el) {
					setGlobalSubheaderElementId(info);
				} else {
					setGlobalSubheaderElementId(null);
				}
			} catch (_e) {}
		}

		if (savedSound !== null) {
			setEnableTransitionSound(savedSound === "true");
		}

		if (savedItemCount) {
			const parsed = parseInt(savedItemCount, 10);
			if (!isNaN(parsed)) setItemCount(parsed);
		}
	}, [activeProjectId, editor.timeline]);

	// Persist state changes to localStorage per project
	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-items-${activeProjectId}`,
			JSON.stringify(rankings),
		);
	}, [rankings, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-map-${activeProjectId}`,
			JSON.stringify(Array.from(timelineElementMap.entries())),
		);
	}, [timelineElementMap, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-header-${activeProjectId}`,
			globalHeader,
		);
	}, [globalHeader, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		if (globalHeaderElementId) {
			localStorage.setItem(
				`opencut-rankings-header-id-${activeProjectId}`,
				JSON.stringify(globalHeaderElementId),
			);
		} else {
			localStorage.removeItem(
				`opencut-rankings-header-id-${activeProjectId}`,
			);
		}
	}, [globalHeaderElementId, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-subheader-${activeProjectId}`,
			globalSubheader,
		);
	}, [globalSubheader, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		if (globalSubheaderElementId) {
			localStorage.setItem(
				`opencut-rankings-subheader-id-${activeProjectId}`,
				JSON.stringify(globalSubheaderElementId),
			);
		} else {
			localStorage.removeItem(
				`opencut-rankings-subheader-id-${activeProjectId}`,
			);
		}
	}, [globalSubheaderElementId, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-sound-${activeProjectId}`,
			String(enableTransitionSound),
		);
	}, [enableTransitionSound, activeProjectId]);

	useEffect(() => {
		if (typeof window === "undefined" || !activeProjectId) return;
		localStorage.setItem(
			`opencut-rankings-itemcount-${activeProjectId}`,
			String(itemCount),
		);
	}, [itemCount, activeProjectId]);

	// Create or update global header element on timeline
	useEffect(() => {
		// If we already have a global header element, just update it
		if (globalHeaderElementId) {
			editor.timeline.updateElements({
				updates: [
					{
						trackId: globalHeaderElementId.trackId,
						elementId: globalHeaderElementId.elementId,
						patch: {
							content: globalHeader || " ",
						},
					},
				],
			});
			return;
		}

		// Create new global header element if text is not empty
		if (globalHeader.trim()) {
			const headerElement = buildTextElement({
				raw: {
					name: "Rankings Header",
					content: globalHeader,
					fontSize: 5,
					color: "#FFFFFF",
					strokeColor: "#000000",
					strokeWidth: 10,
					textAlign: "center",
					fontWeight: "bold",
					background: {
						color: "transparent",
						enabled: false,
					},
					duration: Math.round(120 * TICKS_PER_SECOND),
					transform: {
						scaleX: 1,
						scaleY: 1,
						position: { x: 0, y: -680 },
						rotate: 0,
					},
				},
				startTime: 0,
			});

			const cmd = new InsertElementCommand({
				element: headerElement,
				placement: { mode: "auto", trackType: "text" },
			});
			editor.command.execute({ command: cmd });
			const elementId = cmd.getElementId();
			const trackId = cmd.getTrackId();
			if (elementId && trackId) {
				setGlobalHeaderElementId({ trackId, elementId });
				console.log("✓ Created global header element:", elementId);
			}
		}
	}, [globalHeader, globalHeaderElementId, editor]);

	// Create or update global subheader element on timeline
	useEffect(() => {
		// If we already have a global subheader element, just update it
		if (globalSubheaderElementId) {
			editor.timeline.updateElements({
				updates: [
					{
						trackId: globalSubheaderElementId.trackId,
						elementId: globalSubheaderElementId.elementId,
						patch: {
							content: globalSubheader || " ",
						},
					},
				],
			});
			return;
		}

		// Create new global subheader element if text is not empty
		if (globalSubheader.trim()) {
			const subheaderElement = buildTextElement({
				raw: {
					name: "Rankings Subheader",
					content: globalSubheader,
					fontSize: 7,
					color: "#FFFFFF",
					strokeColor: "#000000",
					strokeWidth: 10,
					textAlign: "center",
					fontWeight: "bold",
					background: {
						color: "transparent",
						enabled: false,
					},
					duration: Math.round(120 * TICKS_PER_SECOND),
					transform: {
						scaleX: 1,
						scaleY: 1,
						position: { x: 0, y: -600 },
						rotate: 0,
					},
				},
				startTime: 0,
			});

			const cmd = new InsertElementCommand({
				element: subheaderElement,
				placement: { mode: "auto", trackType: "text" },
			});
			editor.command.execute({ command: cmd });
			const elementId = cmd.getElementId();
			const trackId = cmd.getTrackId();
			if (elementId && trackId) {
				setGlobalSubheaderElementId({ trackId, elementId });
				console.log("✓ Created global subheader element:", elementId);
			}
		}
	}, [globalSubheader, globalSubheaderElementId, editor]);

	const handleItemCountChange = (val: string) => {
		if (val === "") {
			setItemCount("");
			return;
		}
		const num = Math.max(1, parseInt(val, 10) || 1);
		setItemCount(num);

		if (rankings.length > 0) {
			const totalCount = Math.max(num, rankings.length);
			const updatedRankings = rankings.map((r, idx) => {
				const rNum = totalCount - idx;
				return {
					...r,
					rankingNumber: rNum,
					numberColor: rNum <= 3 ? defaultColors[rNum - 1] : r.numberColor,
				};
			});
			setRankings(updatedRankings);

			const updatesList: Array<{
				trackId: string;
				elementId: string;
				patch: Partial<import("@/lib/timeline").TimelineElement>;
			}> = [];

			updatedRankings.forEach((r) => {
				const info = timelineElementMap.get(r.id);
				if (info?.numberId && info?.trackId) {
					const yPosition = -450 + (r.rankingNumber - 1) * 150;
					updatesList.push({
						trackId: info.trackId,
						elementId: info.numberId,
						patch: {
							content: `${r.rankingNumber}.`,
							color: r.numberColor,
							transform: {
								scaleX: 1,
								scaleY: 1,
								position: { x: -400, y: yPosition },
								rotate: 0,
							},
						},
					});
				}
			});

			if (updatesList.length > 0) {
				editor.timeline.updateElements({ updates: updatesList });
			}
		}
	};

	const handleAddRanking = () => {
		const targetTotal =
			typeof itemCount === "number" ? itemCount : parseInt(itemCount, 10) || 5;

		const index = rankings.length;
		const totalCount = Math.max(targetTotal, index + 1);

		if (totalCount > targetTotal) {
			setItemCount(totalCount);
		}

		let updatedExistingRankings = rankings;
		const existingUpdatesList: Array<{
			trackId: string;
			elementId: string;
			patch: Partial<import("@/lib/timeline").TimelineElement>;
		}> = [];

		if (totalCount > targetTotal) {
			updatedExistingRankings = rankings.map((r, idx) => {
				const rNum = totalCount - idx;
				return {
					...r,
					rankingNumber: rNum,
					numberColor: rNum <= 3 ? defaultColors[rNum - 1] : r.numberColor,
				};
			});

			updatedExistingRankings.forEach((r) => {
				const info = timelineElementMap.get(r.id);
				if (info?.numberId && info?.trackId) {
					const yPosition = -450 + (r.rankingNumber - 1) * 150;
					existingUpdatesList.push({
						trackId: info.trackId,
						elementId: info.numberId,
						patch: {
							content: `${r.rankingNumber}.`,
							color: r.numberColor,
							transform: {
								scaleX: 1,
								scaleY: 1,
								position: { x: -400, y: yPosition },
								rotate: 0,
							},
						},
					});
				}
			});
		}

		const rankingNumber = totalCount - index;
		const numberColor =
			rankingNumber <= 3 ? defaultColors[rankingNumber - 1] : "#FFFFFF";

		const newRanking: RankingItem = {
			id: `ranking-${Date.now()}`,
			rankingNumber,
			title: "",
			titleColor: "#FFFFFF",
			titleBgColor: "transparent",
			numberColor: numberColor,
			numberBgColor: "transparent",
			strokeColor: "#000000",
			strokeWidth: 13,
			titleStrokeWidth: 8,
			platform: "tiktok",
			videoUrl: "",
			isLoadingVideo: false,
			duration: 5, // default 5 seconds
		};

		// Calculate Y position: start at -450, then add 150px for each subsequent ranking
		const yPosition = -450 + (rankingNumber - 1) * 150;

		// Calculate title start time (in ticks): sum of all previous title durations
		const titleStartTimeSeconds = updatedExistingRankings.reduce(
			(acc, r) => acc + r.duration,
			0,
		);
		const titleStartTimeTicks = Math.round(
			titleStartTimeSeconds * TICKS_PER_SECOND,
		);

		// Add number element - starts at time 0
		const numberElement = buildTextElement({
			raw: {
				name: `Ranking ${rankingNumber} Number`,
				content: `${rankingNumber}.`,
				color: newRanking.numberColor,
				strokeColor: newRanking.strokeColor ?? "#000000",
				strokeWidth: newRanking.strokeWidth ?? 13,
				background: {
					color: newRanking.numberBgColor,
					enabled: newRanking.numberBgColor !== "transparent",
				},
				fontWeight: "bold",
				fontSize: 5,
				duration: Math.round(120 * TICKS_PER_SECOND),
				transform: {
					scaleX: 1,
					scaleY: 1,
					position: { x: -400, y: yPosition },
					rotate: 0,
				},
			},
			startTime: 0,
		});

		const numberCmd = new InsertElementCommand({
			element: numberElement,
			placement: { mode: "auto", trackType: "text" },
		});
		editor.command.execute({ command: numberCmd });
		const numberId = numberCmd.getElementId();
		const numberTrackId = numberCmd.getTrackId();

		// Add title element - starts sequentially
		const titleElement = buildTextElement({
			raw: {
				name: `Ranking ${rankingNumber} Title`,
				content: " ", // Use space instead of empty string to ensure element is created
				color: newRanking.titleColor,
				strokeColor: newRanking.strokeColor ?? "#000000",
				strokeWidth: newRanking.titleStrokeWidth ?? 8,
				background: {
					color: newRanking.titleBgColor,
					enabled: newRanking.titleBgColor !== "transparent",
				},
				fontSize: 5,
				textAlign: "left",
				duration: Math.round(120 * TICKS_PER_SECOND),
				transform: {
					scaleX: 1,
					scaleY: 1,
					position: { x: -360, y: yPosition },
					rotate: 0,
				},
			},
			startTime: titleStartTimeTicks,
		});

		const titleCmd = new InsertElementCommand({
			element: titleElement,
			placement: { mode: "auto", trackType: "text" },
		});
		editor.command.execute({ command: titleCmd });
		const titleId = titleCmd.getElementId();
		const titleTrackId = titleCmd.getTrackId();

		// Add audio transition element at the end of the ranking duration
		let audioId: string | undefined = undefined;
		let audioTrackId: string | undefined = undefined;

		if (enableTransitionSound) {
			const audioDurationTicks = Math.round(1 * TICKS_PER_SECOND);
			const audioStartTimeTicks = titleStartTimeTicks + Math.round(newRanking.duration * TICKS_PER_SECOND);
			const audioElement = buildLibraryAudioElement({
				sourceUrl: "/transitionswoosh.mp3",
				name: `Ranking ${rankingNumber} Transition`,
				duration: audioDurationTicks,
				startTime: audioStartTimeTicks > 0 ? audioStartTimeTicks : 0,
			});

			const audioCmd = new InsertElementCommand({
				element: audioElement,
				placement: { mode: "auto", trackType: "audio" },
			});
			editor.command.execute({ command: audioCmd });
			audioId = audioCmd.getElementId() ?? undefined;
			audioTrackId = audioCmd.getTrackId() ?? undefined;
		}

		if (numberId && numberTrackId && titleId && titleTrackId) {
			setTimelineElementMap((prev) => {
				const newMap = new Map(prev);
				newMap.set(newRanking.id, {
					trackId: numberTrackId,
					numberId,
					titleId,
					titleTrackId,
					audioId,
					audioTrackId,
				});
				return newMap;
			});
		}

		setRankings([...updatedExistingRankings, newRanking]);

		if (existingUpdatesList.length > 0) {
			editor.timeline.updateElements({ updates: existingUpdatesList });
		}
	};

	const handleDeleteRanking = (id: string) => {
		const newRankings = rankings.filter((r) => r.id !== id);
		const newTotal = newRankings.length;
		const updatedRankings = newRankings.map((r, idx) => {
			const rNum = newTotal - idx;
			return {
				...r,
				rankingNumber: rNum,
				numberColor: rNum <= 3 ? defaultColors[rNum - 1] : r.numberColor,
			};
		});
		setRankings(updatedRankings);

		const updatesList: Array<{
			trackId: string;
			elementId: string;
			patch: Partial<import("@/lib/timeline").TimelineElement>;
		}> = [];

		updatedRankings.forEach((r) => {
			const info = timelineElementMap.get(r.id);
			if (info?.numberId && info?.trackId) {
				const yPosition = -450 + (r.rankingNumber - 1) * 150;
				updatesList.push({
					trackId: info.trackId,
					elementId: info.numberId,
					patch: {
						content: `${r.rankingNumber}.`,
						color: r.numberColor,
						transform: {
							scaleX: 1,
							scaleY: 1,
							position: { x: -400, y: yPosition },
							rotate: 0,
						},
					},
				});
			}
		});

		const elementInfo = timelineElementMap.get(id);
		if (elementInfo) {
			const elementsToDelete = [];
			if (elementInfo.numberId && elementInfo.trackId) {
				elementsToDelete.push({
					trackId: elementInfo.trackId,
					elementId: elementInfo.numberId,
				});
			}
			if (elementInfo.titleId && elementInfo.titleTrackId) {
				elementsToDelete.push({
					trackId: elementInfo.titleTrackId,
					elementId: elementInfo.titleId,
				});
			}
			if (elementInfo.videoId && elementInfo.videoTrackId) {
				elementsToDelete.push({
					trackId: elementInfo.videoTrackId,
					elementId: elementInfo.videoId,
				});
			}
			if (elementInfo.audioId && elementInfo.audioTrackId) {
				elementsToDelete.push({
					trackId: elementInfo.audioTrackId,
					elementId: elementInfo.audioId,
				});
			}
			if (elementsToDelete.length > 0) {
				editor.timeline.deleteElements({ elements: elementsToDelete });
			}
		}

		if (updatesList.length > 0) {
			editor.timeline.updateElements({ updates: updatesList });
		}
	};

	const handleUpdateRanking = (
		id: string,
		updates: Partial<RankingItem>,
		customMap?: Map<
			string,
			{
				trackId: string;
				numberId: string;
				titleId: string;
				titleTrackId: string;
				videoId?: string;
				videoTrackId?: string;
				audioId?: string;
				audioTrackId?: string;
			}
		>,
	) => {
		const currentMap = customMap || timelineElementMap;
		const updatesList: Array<{
			trackId: string;
			elementId: string;
			patch: Partial<import("@/lib/timeline").TimelineElement>;
		}> = [];

		setRankings((prev) => {
			const currentRanking = prev.find((r) => r.id === id);
			if (!currentRanking) return prev;

			const updatedRanking = { ...currentRanking, ...updates };

			const elementInfo = currentMap.get(id);
			if (elementInfo) {
				// Handle visual content / color / stroke updates
				if (
					updates.numberColor !== undefined ||
					updates.numberBgColor !== undefined ||
					updates.strokeColor !== undefined ||
					updates.strokeWidth !== undefined
				) {
					updatesList.push({
						trackId: elementInfo.trackId,
						elementId: elementInfo.numberId,
						patch: {
							content: `${updatedRanking.rankingNumber}.`,
							color: updatedRanking.numberColor,
							strokeColor: updatedRanking.strokeColor ?? "#000000",
							strokeWidth: updatedRanking.strokeWidth ?? 13,
							background: {
								color: updatedRanking.numberBgColor,
								enabled: updatedRanking.numberBgColor !== "transparent",
							},
						},
					});
				}

				if (
					updates.title !== undefined ||
					updates.titleColor !== undefined ||
					updates.titleBgColor !== undefined ||
					updates.strokeColor !== undefined ||
					updates.strokeWidth !== undefined ||
					updates.titleStrokeWidth !== undefined
				) {
					updatesList.push({
						trackId: elementInfo.titleTrackId,
						elementId: elementInfo.titleId,
						patch: {
							content: updatedRanking.title || " ",
							color: updatedRanking.titleColor,
							strokeColor: updatedRanking.strokeColor ?? "#000000",
							strokeWidth:
								updatedRanking.titleStrokeWidth ??
								updatedRanking.strokeWidth ??
								8,
							background: {
								color: updatedRanking.titleBgColor,
								enabled: updatedRanking.titleBgColor !== "transparent",
							},
						},
					});
				}
			}

			// Update start times of subsequent titles/videos when duration changes
			if (updates.duration !== undefined) {
				let accumulatedTimeSeconds = 0;
				const updatedRankings = prev.map((r) =>
					r.id === id ? updatedRanking : r,
				);

				updatedRankings.forEach((r) => {
					const rElementInfo = currentMap.get(r.id);
					if (rElementInfo) {
						const accumulatedTimeTicks = Math.round(
							accumulatedTimeSeconds * TICKS_PER_SECOND,
						);

						// Check/update title start time
						const titleTrack = editor.timeline.getTrackById({
							trackId: rElementInfo.titleTrackId,
						});
						const titleElement = titleTrack?.elements.find(
							(el) => el.id === rElementInfo.titleId,
						);
						if (
							titleElement &&
							titleElement.startTime !== accumulatedTimeTicks
						) {
							updatesList.push({
								trackId: rElementInfo.titleTrackId,
								elementId: rElementInfo.titleId,
								patch: { startTime: accumulatedTimeTicks },
							});
						}

						// Check/update audio start time
						if (rElementInfo.audioId && rElementInfo.audioTrackId) {
							const audioTrack = editor.timeline.getTrackById({
								trackId: rElementInfo.audioTrackId,
							});
							const audioElement = audioTrack?.elements.find(
								(el) => el.id === rElementInfo.audioId,
							);
							if (audioElement) {
								const audioDurationTicks = Math.round(1 * TICKS_PER_SECOND);
								const expectedAudioStartTime = accumulatedTimeTicks + Math.round(r.duration * TICKS_PER_SECOND);
								if (audioElement.startTime !== (expectedAudioStartTime > 0 ? expectedAudioStartTime : 0)) {
									updatesList.push({
										trackId: rElementInfo.audioTrackId,
										elementId: rElementInfo.audioId,
										patch: { startTime: expectedAudioStartTime > 0 ? expectedAudioStartTime : 0 },
									});
								}
							}
						}

						// Check/update video start time & duration
						if (rElementInfo.videoId && rElementInfo.videoTrackId) {
							const videoTrack = editor.timeline.getTrackById({
								trackId: rElementInfo.videoTrackId,
							});
							const videoElement = videoTrack?.elements.find(
								(el) => el.id === rElementInfo.videoId,
							);
							if (videoElement) {
								const patch: Partial<import("@/lib/timeline").TimelineElement> =
									{};
								if (videoElement.startTime !== accumulatedTimeTicks) {
									patch.startTime = accumulatedTimeTicks;
								}
								const targetDurationTicks = Math.round(
									r.duration * TICKS_PER_SECOND,
								);
								if (videoElement.duration !== targetDurationTicks) {
									patch.duration = targetDurationTicks;
								}
								if (Object.keys(patch).length > 0) {
									updatesList.push({
										trackId: rElementInfo.videoTrackId,
										elementId: rElementInfo.videoId,
										patch,
									});
								}
							}
						}
					}
					accumulatedTimeSeconds += r.duration;
				});
			}

			return prev.map((r) => (r.id === id ? updatedRanking : r));
		});

		// Apply timeline updates synchronously after setRankings callback completes
		if (updatesList.length > 0) {
			editor.timeline.updateElements({ updates: updatesList });
		}
	};

	const processVideoFile = async (id: string, file: File) => {
		if (!activeProject) {
			console.error("No active project");
			return;
		}
		if (!file.type.startsWith("video/")) {
			console.error("Only video files are allowed");
			return;
		}

		const ranking = rankings.find((r) => r.id === id);
		if (!ranking) return;

		const index = rankings.findIndex((r) => r.id === id);
		const startTimeSeconds = rankings
			.slice(0, index)
			.reduce((acc, r) => acc + r.duration, 0);
		const startTimeTicks = Math.round(startTimeSeconds * TICKS_PER_SECOND);

		console.log("Processing video file...", file.name);

		const processedAssets = await processMediaAssets({
			files: [file],
			onProgress: (p) => console.log(`Processing: ${p.progress}%`),
		});

		if (processedAssets.length === 0) {
			console.error("Failed to process video");
			return;
		}

		const asset = processedAssets[0];
		const addedAsset = await editor.media.addMediaAsset({
			projectId: activeProject.metadata.id,
			asset,
		});

		if (!addedAsset) {
			console.error("Failed to add asset to library");
			return;
		}

		console.log("Added to media library:", addedAsset.id);

		const durationTicks = Math.round(
			(addedAsset.duration || 30) * TICKS_PER_SECOND,
		);
		const element = buildElementFromMedia({
			mediaId: addedAsset.id,
			mediaType: addedAsset.type,
			name: addedAsset.name,
			duration: durationTicks,
			startTime: startTimeTicks,
		});

		const cmd = new InsertElementCommand({
			element,
			placement: { mode: "auto", trackType: "video" },
		});
		editor.command.execute({ command: cmd });
		const videoId = cmd.getElementId();
		const videoTrackId = cmd.getTrackId();

		if (videoId && videoTrackId) {
			const updatedMap = new Map(timelineElementMap);
			const existing = updatedMap.get(id);
			if (existing) {
				updatedMap.set(id, {
					...existing,
					videoId,
					videoTrackId,
				});
				console.log(`Linked video to ranking item ${id}`);
			}
			setTimelineElementMap(updatedMap);

			const videoDurationSeconds = addedAsset.duration || 30;

			// Update ranking duration and calculate start times for subsequent items synchronously
			let accumulatedTimeSeconds = 0;
			const updatedRankings = rankings.map((r) =>
				r.id === id
					? {
							...r,
							maxDuration: videoDurationSeconds,
							duration: videoDurationSeconds,
						}
					: r,
			);

			setRankings(updatedRankings);

			const updatesList: Array<{
				trackId: string;
				elementId: string;
				patch: Partial<import("@/lib/timeline").TimelineElement>;
			}> = [];

			updatedRankings.forEach((r) => {
				const rElementInfo = updatedMap.get(r.id);
				if (rElementInfo) {
					const accumulatedTimeTicks = Math.round(
						accumulatedTimeSeconds * TICKS_PER_SECOND,
					);

					// Check/update title start time
					const titleTrack = editor.timeline.getTrackById({
						trackId: rElementInfo.titleTrackId,
					});
					const titleElement = titleTrack?.elements.find(
						(el) => el.id === rElementInfo.titleId,
					);
					if (
						titleElement &&
						titleElement.startTime !== accumulatedTimeTicks
					) {
						updatesList.push({
							trackId: rElementInfo.titleTrackId,
							elementId: rElementInfo.titleId,
							patch: { startTime: accumulatedTimeTicks },
						});
					}

					// Check/update audio start time
					if (rElementInfo.audioId && rElementInfo.audioTrackId) {
						const audioTrack = editor.timeline.getTrackById({
							trackId: rElementInfo.audioTrackId,
						});
						const audioElement = audioTrack?.elements.find(
							(el) => el.id === rElementInfo.audioId,
						);
						if (audioElement) {
							const audioDurationTicks = Math.round(1 * TICKS_PER_SECOND);
							const expectedAudioStartTime = accumulatedTimeTicks + Math.round(r.duration * TICKS_PER_SECOND);
							if (audioElement.startTime !== (expectedAudioStartTime > 0 ? expectedAudioStartTime : 0)) {
								updatesList.push({
									trackId: rElementInfo.audioTrackId,
									elementId: rElementInfo.audioId,
									patch: { startTime: expectedAudioStartTime > 0 ? expectedAudioStartTime : 0 },
								});
							}
						}
					}

					// Check/update video start time & duration
					if (rElementInfo.videoId && rElementInfo.videoTrackId) {
						const videoTrack = editor.timeline.getTrackById({
							trackId: rElementInfo.videoTrackId,
						});
						const videoElement = videoTrack?.elements.find(
							(el) => el.id === rElementInfo.videoId,
						);
						if (videoElement) {
							const patch: Partial<import("@/lib/timeline").TimelineElement> = {};
							if (videoElement.startTime !== accumulatedTimeTicks) {
								patch.startTime = accumulatedTimeTicks;
							}
							const targetDurationTicks = Math.round(
								r.duration * TICKS_PER_SECOND,
							);
							if (videoElement.duration !== targetDurationTicks) {
								patch.duration = targetDurationTicks;
							}
							if (Object.keys(patch).length > 0) {
								updatesList.push({
									trackId: rElementInfo.videoTrackId,
									elementId: rElementInfo.videoId,
									patch,
								});
							}
						}
					}
				}
				accumulatedTimeSeconds += r.duration;
			});

			if (updatesList.length > 0) {
				editor.timeline.updateElements({ updates: updatesList });
			}
		}
	};

	const handleFetchVideo = async (id: string) => {
		const ranking = rankings.find((r) => r.id === id);
		if (!ranking || !ranking.videoUrl.trim()) return;

		handleUpdateRanking(id, { isLoadingVideo: true });

		try {
			if (ranking.platform === "tiktok") {
				const videoIdMatch = ranking.videoUrl.match(/\/video\/(\d+)/);
				if (!videoIdMatch) {
					console.error("Could not extract TikTok video ID from URL");
					handleUpdateRanking(id, { isLoadingVideo: false });
					return;
				}

				const videoId = videoIdMatch[1];
				console.log(`Fetching TikTok video ID: ${videoId}`);

				let videoUrl: string | null = null;

				try {
					const tikwmRes = await fetch(
						`https://www.tikwm.com/api/?url=https://www.tiktok.com/video/${videoId}`,
					);
					if (tikwmRes.ok) {
						const tikwmData = await tikwmRes.json();
						if (tikwmData.code === 0 && tikwmData.data?.play) {
							videoUrl = tikwmData.data.play;
						}
					}
				} catch (e) {
					console.warn(
						"Client fetch via TikWM failed, trying backend route...",
						e,
					);
				}

				if (!videoUrl) {
					throw new Error("No video URL found from any source");
				}

				console.log(`Got video URL: ${videoUrl}`);

				// Download video as blob first to avoid CORS issues
				console.log("Downloading video...");
				const videoResponse = await fetch(videoUrl);
				const videoBlob = await videoResponse.blob();

				const videoFile = new File(
					[videoBlob],
					`ranking-${ranking.rankingNumber}-${ranking.title || "video"}.mp4`,
					{ type: videoBlob.type || "video/mp4" },
				);

				// Create object URL from blob for browser download
				const blobUrl = URL.createObjectURL(videoBlob);
				const link = document.createElement("a");
				link.href = blobUrl;
				link.download = videoFile.name;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

				// Automatically add video to media library and timeline
				await processVideoFile(id, videoFile);

				console.log("Video downloaded and added to timeline successfully!");
				handleUpdateRanking(id, { isLoadingVideo: false });
			} else {
				console.log(`Platform ${ranking.platform} not implemented yet`);
				handleUpdateRanking(id, { isLoadingVideo: false });
			}
		} catch (error) {
			console.error("Error fetching video:", error);
			handleUpdateRanking(id, { isLoadingVideo: false });
		}
	};

	const handleDropVideo = async (id: string, files: FileList) => {
		if (!files || files.length === 0) return;
		handleUpdateRanking(id, { isLoadingVideo: true });

		try {
			await processVideoFile(id, files[0]);
		} catch (error) {
			console.error("Error processing dropped video:", error);
		} finally {
			handleUpdateRanking(id, { isLoadingVideo: false });
		}
	};

	const handleDragOver = (e: React.DragEvent, id: string) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverId(id);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverId(null);
	};

	const handleDrop = (e: React.DragEvent, id: string) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverId(null);

		const files = e.dataTransfer.files;
		handleDropVideo(id, files);
	};

	const handleAddTitleToTimeline = (ranking: RankingItem) => {
		const element = buildTextElement({
			raw: {
				name: ranking.title || `Ranking ${ranking.rankingNumber}`,
				content: ranking.title || `Ranking ${ranking.rankingNumber}`,
				color: ranking.titleColor,
				strokeColor: ranking.strokeColor ?? "#000000",
				strokeWidth: ranking.titleStrokeWidth ?? 8,
				background: {
					color: ranking.titleBgColor,
					enabled: ranking.titleBgColor !== "transparent",
				},
			},
			startTime: editor.playback.getCurrentTime(),
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	return (
		<PanelView title="Rankings" ref={containerRef}>
			<div className="space-y-4 pt-1">
				{/* Global header text */}
				<div className="space-y-1">
					<span className="block text-xs font-medium text-muted-foreground">
						Header Text (appears above all videos)
					</span>
					<Input
						placeholder="Enter header text for all rankings..."
						value={globalHeader}
						onChange={(e) => setGlobalHeader(e.target.value)}
						className="h-9 text-sm bg-background font-medium"
					/>
				</div>

				{/* Global subheader text */}
				<div className="space-y-1">
					<span className="block text-xs font-medium text-muted-foreground">
						Subheader Text
					</span>
					<Input
						placeholder="Enter subheader text..."
						value={globalSubheader}
						onChange={(e) => setGlobalSubheader(e.target.value)}
						className="h-9 text-sm bg-background font-medium"
					/>
				</div>

				<div className="flex items-center space-x-2 pt-2 pb-2">
					<Checkbox
						id="enable-transition-sound"
						checked={enableTransitionSound}
						onCheckedChange={(checked) => setEnableTransitionSound(!!checked)}
					/>
					<label
						htmlFor="enable-transition-sound"
						className="text-xs font-medium text-muted-foreground cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						Add Swoosh Transition Sound
					</label>
				</div>

				{/* Default colors for top 3 */}
				<div className="space-y-1">
					<span className="block text-xs font-medium text-muted-foreground">
						Default Colors for Top 3
					</span>
					<div className="flex gap-2 items-center">
						{[0, 1, 2].map((index) => (
							<Popover
								key={index}
								open={
									colorPickerOpen?.type === `default${(index + 1) as 1 | 2 | 3}`
								}
								onOpenChange={(open) =>
									setColorPickerOpen(
										open
											? { id: "", type: `default${(index + 1) as 1 | 2 | 3}` }
											: null,
									)
								}
							>
								<PopoverTrigger asChild>
									<button
										type="button"
										className="w-10 h-10 rounded-md border border-border hover:scale-105 transition-transform flex items-center justify-center font-bold text-sm cursor-pointer"
										style={{
											backgroundColor: defaultColors[index],
											color: "#000",
										}}
										aria-label={`Set color for rank ${index + 1}`}
									>
										{index + 1}
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-3" align="start">
									<div className="space-y-2">
										<span className="block text-xs font-medium">
											Rank {index + 1} Color
										</span>
										<ColorPicker
											value={defaultColors[index].replace("#", "")}
											onChange={(color) => {
												const newColors: [string, string, string] = [
													...defaultColors,
												];
												newColors[index] = `#${color}`;
												setDefaultColors(newColors);
											}}
										/>
									</div>
								</PopoverContent>
							</Popover>
						))}
					</div>
				</div>

				{/* Add new ranking button with quantity input */}
				<div className="space-y-1">
					<span className="block text-xs font-medium text-muted-foreground">
						Number of Items
					</span>
					<div className="flex gap-2 items-center">
						<Input
							type="number"
							min={1}
							max={50}
							value={itemCount}
							onChange={(e) => handleItemCountChange(e.target.value)}
							className="w-20 h-9 text-sm bg-background font-medium"
						/>
						<Button
							onClick={handleAddRanking}
							className="flex-1 flex items-center justify-center gap-1.5 h-9"
							size="sm"
						>
							<HugeiconsIcon icon={PlusSignIcon} size={16} />
							Add Ranking Item
						</Button>
					</div>
				</div>

				{/* Rankings list */}
				{rankings.length > 0 && (
					<div className="space-y-3 pb-4">
						{rankings.map((ranking, index) => (
							<div
								key={ranking.id}
								role="none"
								className={`bg-muted/30 rounded-lg p-3 space-y-3 border transition-colors ${
									dragOverId === ranking.id
										? "border-primary bg-primary/5"
										: "border-border"
								}`}
								onDragOver={(e) => handleDragOver(e, ranking.id)}
								onDragLeave={handleDragLeave}
								onDrop={(e) => handleDrop(e, ranking.id)}
							>
								{/* Header: Number with color buttons */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1.5">
										<span
											className="text-sm font-bold px-2 py-0.5 rounded"
											style={{
												color: ranking.numberColor,
												backgroundColor: ranking.numberBgColor,
											}}
										>
											{ranking.rankingNumber}
										</span>

										{/* Number color picker */}
										<Popover
											open={
												colorPickerOpen?.id === ranking.id &&
												colorPickerOpen?.type === "number"
											}
											onOpenChange={(open) =>
												setColorPickerOpen(
													open ? { id: ranking.id, type: "number" } : null,
												)
											}
										>
											<PopoverTrigger asChild>
												<button
													type="button"
													className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform cursor-pointer"
													style={{ backgroundColor: ranking.numberColor }}
													aria-label="Change number color"
												/>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-3" align="start">
												<div className="space-y-2">
													<span className="block text-xs font-medium">
														Number Color
													</span>
													<ColorPicker
														value={ranking.numberColor.replace("#", "")}
														onChange={(color) =>
															handleUpdateRanking(ranking.id, {
																numberColor: `#${color}`,
															})
														}
													/>
												</div>
											</PopoverContent>
										</Popover>

										{/* Number background color picker */}
										<Popover
											open={
												colorPickerOpen?.id === ranking.id &&
												colorPickerOpen?.type === "numberBg"
											}
											onOpenChange={(open) =>
												setColorPickerOpen(
													open ? { id: ranking.id, type: "numberBg" } : null,
												)
											}
										>
											<PopoverTrigger asChild>
												<button
													type="button"
													className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform cursor-pointer"
													style={{
														backgroundColor:
															ranking.numberBgColor === "transparent"
																? "#ffffff"
																: ranking.numberBgColor,
														backgroundImage:
															ranking.numberBgColor === "transparent"
																? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)"
																: undefined,
														backgroundSize:
															ranking.numberBgColor === "transparent"
																? "8px 8px"
																: undefined,
														backgroundPosition:
															ranking.numberBgColor === "transparent"
																? "0 0, 4px 4px"
																: undefined,
													}}
													aria-label="Change number background"
												/>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-3" align="start">
												<div className="space-y-2">
													<span className="block text-xs font-medium">
														Number Background
													</span>
													<ColorPicker
														value={
															ranking.numberBgColor === "transparent"
																? "000000"
																: ranking.numberBgColor.replace("#", "")
														}
														onChange={(color) =>
															handleUpdateRanking(ranking.id, {
																numberBgColor: `#${color}`,
															})
														}
													/>
													<Button
														variant="outline"
														size="sm"
														className="w-full text-xs"
														onClick={() =>
															handleUpdateRanking(ranking.id, {
																numberBgColor: "transparent",
															})
														}
													>
														Transparent
													</Button>
												</div>
											</PopoverContent>
										</Popover>
									</div>

									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => handleDeleteRanking(ranking.id)}
									>
										<HugeiconsIcon icon={Delete02Icon} size={14} />
									</Button>
								</div>

								{/* Title input with color buttons */}
								<div className="flex items-center gap-1.5">
									<Input
										placeholder="Enter title..."
										value={ranking.title}
										onChange={(e) =>
											handleUpdateRanking(ranking.id, {
												title: e.target.value,
											})
										}
										className="flex-1 h-8 text-xs bg-background"
										style={{
											color: ranking.titleColor,
											backgroundColor: ranking.titleBgColor,
										}}
									/>

									{/* Title color picker */}
									<Popover
										open={
											colorPickerOpen?.id === ranking.id &&
											colorPickerOpen?.type === "title"
										}
										onOpenChange={(open) =>
											setColorPickerOpen(
												open ? { id: ranking.id, type: "title" } : null,
											)
										}
									>
										<PopoverTrigger asChild>
											<button
												type="button"
												className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform cursor-pointer"
												style={{ backgroundColor: ranking.titleColor }}
												aria-label="Change title color"
											/>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-3" align="end">
											<div className="space-y-2">
												<span className="block text-xs font-medium">
													Title Color
												</span>
												<ColorPicker
													value={ranking.titleColor.replace("#", "")}
													onChange={(color) =>
														handleUpdateRanking(ranking.id, {
															titleColor: `#${color}`,
														})
													}
												/>
											</div>
										</PopoverContent>
									</Popover>

									{/* Title background color picker */}
									<Popover
										open={
											colorPickerOpen?.id === ranking.id &&
											colorPickerOpen?.type === "titleBg"
										}
										onOpenChange={(open) =>
											setColorPickerOpen(
												open ? { id: ranking.id, type: "titleBg" } : null,
											)
										}
									>
										<PopoverTrigger asChild>
											<button
												type="button"
												className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform cursor-pointer"
												style={{ backgroundColor: ranking.titleBgColor }}
												aria-label="Change title background"
											/>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-3" align="end">
											<div className="space-y-2">
												<span className="block text-xs font-medium">
													Title Background
												</span>
												<ColorPicker
													value={ranking.titleBgColor.replace("#", "")}
													onChange={(color) =>
														handleUpdateRanking(ranking.id, {
															titleBgColor: `#${color}`,
														})
													}
												/>
											</div>
										</PopoverContent>
									</Popover>

									{/* Stroke color & width picker */}
									<Popover
										open={
											colorPickerOpen?.id === ranking.id &&
											colorPickerOpen?.type === "stroke"
										}
										onOpenChange={(open) =>
											setColorPickerOpen(
												open ? { id: ranking.id, type: "stroke" } : null,
											)
										}
									>
										<PopoverTrigger asChild>
											<button
												type="button"
												className="w-5 h-5 rounded-full border border-primary hover:scale-110 transition-transform cursor-pointer flex items-center justify-center text-[9px] font-bold"
												style={{
													backgroundColor: ranking.strokeColor || "#000000",
													color: "#ffffff",
												}}
												title="Stroke outline color"
												aria-label="Change stroke color"
											>
												S
											</button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-3" align="end">
											<div className="space-y-2">
												<span className="block text-xs font-medium">
													Stroke Outline Color
												</span>
												<ColorPicker
													value={(ranking.strokeColor || "#000000").replace(
														"#",
														"",
													)}
													onChange={(color) =>
														handleUpdateRanking(ranking.id, {
															strokeColor: `#${color}`,
														})
													}
												/>
												<div className="flex items-center justify-between text-xs pt-1 gap-2">
													<span>
														Number Width: {ranking.strokeWidth ?? 13}px
													</span>
													<input
														type="range"
														min="0"
														max="20"
														step="0.5"
														value={ranking.strokeWidth ?? 13}
														onChange={(e) =>
															handleUpdateRanking(ranking.id, {
																strokeWidth: Number.parseFloat(e.target.value),
															})
														}
														className="w-24 h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
													/>
												</div>
												<div className="flex items-center justify-between text-xs pt-1 gap-2">
													<span>
														Title Width: {ranking.titleStrokeWidth ?? 8}px
													</span>
													<input
														type="range"
														min="0"
														max="20"
														step="0.5"
														value={ranking.titleStrokeWidth ?? 8}
														onChange={(e) =>
															handleUpdateRanking(ranking.id, {
																titleStrokeWidth: Number.parseFloat(
																	e.target.value,
																),
															})
														}
														className="w-24 h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
													/>
												</div>
											</div>
										</PopoverContent>
									</Popover>

									{/* Add title to timeline manually */}
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => handleAddTitleToTimeline(ranking)}
										disabled={!ranking.title.trim()}
									>
										<HugeiconsIcon icon={PlusSignIcon} size={14} />
									</Button>
								</div>

								{/* Duration control */}
								<div className="space-y-1">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>Duration: {ranking.duration}s</span>
										{ranking.maxDuration && (
											<span>(max: {ranking.maxDuration}s)</span>
										)}
									</div>
									<input
										type="range"
										min="1"
										max={ranking.maxDuration || 30}
										step="0.5"
										value={ranking.duration}
										onChange={(e) =>
											handleUpdateRanking(ranking.id, {
												duration: Number.parseFloat(e.target.value),
											})
										}
										className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
									/>
								</div>

								{/* Platform selector */}
								<Select
									value={ranking.platform}
									onValueChange={(value: Platform) =>
										handleUpdateRanking(ranking.id, { platform: value })
									}
								>
									<SelectTrigger className="h-8 text-xs bg-background">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="youtube" className="text-xs">
											<span className="flex items-center gap-1.5">
												<HugeiconsIcon icon={YoutubeIcon} size={14} />
												YouTube
											</span>
										</SelectItem>
										<SelectItem value="tiktok" className="text-xs">
											<span className="flex items-center gap-1.5">
												<HugeiconsIcon icon={TiktokIcon} size={14} />
												TikTok
											</span>
										</SelectItem>
										<SelectItem value="instagram" className="text-xs">
											<span className="flex items-center gap-1.5">
												<HugeiconsIcon icon={InstagramIcon} size={14} />
												Instagram
											</span>
										</SelectItem>
										<SelectItem value="twitter" className="text-xs">
											<span className="flex items-center gap-1.5">
												<HugeiconsIcon icon={TwitterIcon} size={14} />
												Twitter/X
											</span>
										</SelectItem>
									</SelectContent>
								</Select>

								{/* Video URL input */}
								<div className="flex gap-1.5">
									<Input
										placeholder="Paste video URL..."
										value={ranking.videoUrl}
										onChange={(e) =>
											handleUpdateRanking(ranking.id, {
												videoUrl: e.target.value,
											})
										}
										className="flex-1 h-8 text-xs bg-background"
									/>
									<Button
										size="sm"
										className="h-8 px-2 flex items-center gap-1"
										onClick={() => handleFetchVideo(ranking.id)}
										disabled={
											!ranking.videoUrl.trim() || ranking.isLoadingVideo
										}
									>
										<HugeiconsIcon icon={Download01Icon} size={12} />
										{ranking.isLoadingVideo ? "Loading..." : "Add"}
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</PanelView>
	);
}
