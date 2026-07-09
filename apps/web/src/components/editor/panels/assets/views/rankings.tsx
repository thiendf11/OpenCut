"use client";

import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { useEditor } from "@/hooks/use-editor";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
	buildTextElement,
	buildElementFromMedia,
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
	title: string;
	titleColor: string;
	titleBgColor: string;
	numberColor: string;
	numberBgColor: string;
	platform: Platform;
	videoUrl: string;
	isLoadingVideo: boolean;
	duration: number; // in seconds
	maxDuration?: number; // max duration based on video length in seconds
}

export function RankingsView() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());

	const [rankings, setRankings] = useState<RankingItem[]>([]);
	const [colorPickerOpen, setColorPickerOpen] = useState<{
		id: string;
		type: "number" | "numberBg" | "title" | "titleBg" | `default${1 | 2 | 3}`;
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
			}
		>
	>(new Map());

	const containerRef = useRef<HTMLDivElement>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [globalHeader, setGlobalHeader] = useState<string>("");
	const [globalHeaderElementId, setGlobalHeaderElementId] = useState<{
		trackId: string;
		elementId: string;
	} | null>(null);

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
					textAlign: "center",
					fontWeight: "bold",
					duration: Math.round(120 * TICKS_PER_SECOND),
					transform: {
						scaleX: 1,
						scaleY: 1,
						position: { x: 0, y: -800 },
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

	const handleAddRanking = () => {
		const rankingNumber = rankings.length + 1;
		const numberColor =
			rankingNumber <= 3 ? defaultColors[rankingNumber - 1] : "#FFFFFF";

		const newRanking: RankingItem = {
			id: `ranking-${Date.now()}`,
			title: "",
			titleColor: "#FFFFFF",
			titleBgColor: "transparent",
			numberColor: numberColor,
			numberBgColor: "transparent",
			platform: "tiktok",
			videoUrl: "",
			isLoadingVideo: false,
			duration: 5, // default 5 seconds
		};

		setRankings([...rankings, newRanking]);

		// Calculate Y position: start at -300, then add 80px for each subsequent ranking
		const yPosition = -600 + (rankingNumber - 1) * 150;

		// Calculate title start time (in ticks): sum of all previous title durations
		const titleStartTimeSeconds = rankings.reduce(
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
					position: { x: -370, y: yPosition },
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

		if (numberId && numberTrackId && titleId && titleTrackId) {
			setTimelineElementMap((prev) => {
				const newMap = new Map(prev);
				newMap.set(newRanking.id, {
					trackId: numberTrackId,
					numberId,
					titleId,
					titleTrackId,
				});
				console.log(`✓ Mapped ranking ${newRanking.id}`);
				return newMap;
			});
		}
	};

	const handleDeleteRanking = (id: string) => {
		setRankings(rankings.filter((r) => r.id !== id));

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
			if (elementsToDelete.length > 0) {
				editor.timeline.deleteElements({ elements: elementsToDelete });
			}
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
			const index = prev.findIndex((r) => r.id === id);
			const rankingNumber = index + 1;

			const elementInfo = currentMap.get(id);
			if (elementInfo) {
				// Handle visual content / color updates
				if (
					updates.numberColor !== undefined ||
					updates.numberBgColor !== undefined
				) {
					updatesList.push({
						trackId: elementInfo.trackId,
						elementId: elementInfo.numberId,
						patch: {
							content: `${rankingNumber}.`,
							color: updatedRanking.numberColor,
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
					updates.titleBgColor !== undefined
				) {
					updatesList.push({
						trackId: elementInfo.titleTrackId,
						elementId: elementInfo.titleId,
						patch: {
							content: updatedRanking.title || " ",
							color: updatedRanking.titleColor,
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

				updatedRankings.forEach((r, _idx) => {
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

		// Apply timeline updates
		if (updatesList.length > 0) {
			editor.timeline.updateElements({ updates: updatesList });
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

				const response = await fetch("/api/fetch-tiktok", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ videoId }),
				});

				if (!response.ok) {
					throw new Error(`API error: ${response.status}`);
				}

				const data = await response.json();
				const videoUrl = data.video_no_watermark?.url;

				if (!videoUrl) {
					throw new Error("No video URL found in response");
				}

				console.log(`Got video URL: ${videoUrl}`);

				const index = rankings.findIndex((r) => r.id === id);

				// Download video as blob first to avoid CORS issues
				console.log("Downloading video...");
				const videoResponse = await fetch(videoUrl);
				const videoBlob = await videoResponse.blob();

				// Create object URL from blob
				const blobUrl = URL.createObjectURL(videoBlob);

				// Download file from blob URL
				const link = document.createElement("a");
				link.href = blobUrl;
				link.download = `ranking-${index + 1}-${ranking.title || "video"}.mp4`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);

				// Clean up blob URL after a delay
				setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

				console.log("Video downloaded successfully!");
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
		if (!activeProject) {
			console.error("No active project");
			return;
		}

		const file = files[0];
		if (!file.type.startsWith("video/")) {
			console.error("Only video files are allowed");
			return;
		}

		handleUpdateRanking(id, { isLoadingVideo: true });

		try {
			const ranking = rankings.find((r) => r.id === id);
			if (!ranking) return;

			const index = rankings.findIndex((r) => r.id === id);
			const startTimeSeconds = rankings
				.slice(0, index)
				.reduce((acc, r) => acc + r.duration, 0);
			const startTimeTicks = Math.round(startTimeSeconds * TICKS_PER_SECOND);

			console.log("Processing dropped video...", file.name);

			const processedAssets = await processMediaAssets({
				files: [file],
				onProgress: (p) => console.log(`Processing: ${p.progress}%`),
			});

			if (processedAssets.length === 0) {
				console.error("Failed to process video");
				handleUpdateRanking(id, { isLoadingVideo: false });
				return;
			}

			const asset = processedAssets[0];
			const addedAsset = await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
				asset,
			});

			if (!addedAsset) {
				console.error("Failed to add asset to library");
				handleUpdateRanking(id, { isLoadingVideo: false });
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
				let updatedMap = timelineElementMap;
				setTimelineElementMap((prev) => {
					const newMap = new Map(prev);
					const existing = newMap.get(id);
					if (existing) {
						newMap.set(id, {
							...existing,
							videoId,
							videoTrackId,
						});
						console.log(`Linked video to ranking item ${id}`);
					}
					updatedMap = newMap;
					return newMap;
				});

				const videoDurationSeconds = addedAsset.duration || 30;
				handleUpdateRanking(
					id,
					{
						maxDuration: videoDurationSeconds,
						duration: videoDurationSeconds,
					},
					updatedMap,
				);

				const finalDurationTicks = Math.round(
					videoDurationSeconds * TICKS_PER_SECOND,
				);
				editor.timeline.updateElements({
					updates: [
						{
							trackId: videoTrackId,
							elementId: videoId,
							patch: { duration: finalDurationTicks },
						},
					],
				});
			}

			handleUpdateRanking(id, { isLoadingVideo: false });
		} catch (error) {
			console.error("Error processing dropped video:", error);
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

	const handleAddTitleToTimeline = (ranking: RankingItem, index: number) => {
		const element = buildTextElement({
			raw: {
				name: ranking.title || `Ranking ${index + 1}`,
				content: ranking.title || `Ranking ${index + 1}`,
				color: ranking.titleColor,
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

				{/* Add new ranking button */}
				<Button
					onClick={handleAddRanking}
					className="w-full flex items-center justify-center gap-1.5"
					size="sm"
				>
					<HugeiconsIcon icon={PlusSignIcon} size={16} />
					Add Ranking Item
				</Button>

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
											{index + 1}
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

									{/* Add title to timeline manually */}
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => handleAddTitleToTimeline(ranking, index)}
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
