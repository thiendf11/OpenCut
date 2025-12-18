"use client";

import { DraggableMediaItem } from "@/components/ui/draggable-item";
import { PanelBaseView as BaseView } from "@/components/editor/panel-base-view";
import { useTimelineStore } from "@/stores/timeline-store";
import { useProjectStore } from "@/stores/project-store";
import { DEFAULT_TEXT_ELEMENT } from "@/constants/text-constants";
import { processMediaFiles } from "@/lib/media-processing";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Plus, Trash2, Download, Palette } from "lucide-react";
import { uppercase } from "@/lib/utils";
import {
  PropertyGroup,
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
} from "../../properties-panel/property-item";
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
  maxDuration?: number; // max duration based on video length
}

export function RankingsView() {
  const { activeProject } = useProjectStore();
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState<{
    id: string;
    type:
      | "number"
      | "numberBg"
      | "title"
      | "titleBg"
      | "default1"
      | "default2"
      | "default3";
  } | null>(null);

  // Default colors for top 3 rankings
  const [defaultColors, setDefaultColors] = useState<[string, string, string]>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("ranking-default-colors");
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      return ["#FFD700", "#C0C0C0", "#CD7F32"]; // Gold, Silver, Bronze
    }
  );

  // Save to localStorage when colors change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "ranking-default-colors",
        JSON.stringify(defaultColors)
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
  const { updateTextElement, tracks } = useTimelineStore();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [globalHeader, setGlobalHeader] = useState<string>("");
  const [globalHeaderElementId, setGlobalHeaderElementId] = useState<{
    trackId: string;
    elementId: string;
  } | null>(null);

  // Create or update global header element on timeline
  useEffect(() => {
    const timelineStore = useTimelineStore.getState();

    // If we already have a global header element, just update it
    if (globalHeaderElementId) {
      timelineStore.updateTextElement(
        globalHeaderElementId.trackId,
        globalHeaderElementId.elementId,
        {
          content: globalHeader || " ",
        }
      );
      return;
    }

    // Create new global header element if text is not empty
    if (globalHeader.trim()) {
      timelineStore.addElementAtTime(
        {
          ...DEFAULT_TEXT_ELEMENT,
          id: "global-header",
          name: "Rankings Header",
          content: globalHeader,
          color: "#FFFFFF",
          backgroundColor: "transparent",
          fontSize: 48,
          textAlign: "center",
          fontWeight: "bold",
          x: 0,
          y: -830,
          textShadow: "6px 6px 4px rgba(0, 0, 0, 1)",
          duration: 120,
        },
        0
      );

      // Find the created element
      setTimeout(() => {
        const allTracks = useTimelineStore.getState().tracks;
        for (const track of allTracks) {
          for (const element of track.elements) {
            if (element.type === "text" && element.name === "Rankings Header") {
              setGlobalHeaderElementId({
                trackId: track.id,
                elementId: element.id,
              });
              console.log("✓ Found global header element:", element.id);
              break;
            }
          }
        }
      }, 100);
    }
  }, [globalHeader, globalHeaderElementId]);

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

    // Add to timeline immediately - create 2 elements: number and title
    // Numbers appear at time 0 throughout the video
    // Titles appear sequentially after each other

    // Calculate Y position: start at -500, then add 100px for each subsequent ranking
    const yPosition = -500 + (rankingNumber - 1) * 100;

    // Calculate title start time: sum of all previous title durations
    const titleStartTime = rankings.reduce((acc, r) => acc + r.duration, 0);

    // Add number element - starts at time 0 with very long duration (throughout video)
    useTimelineStore.getState().addElementAtTime(
      {
        ...DEFAULT_TEXT_ELEMENT,
        id: `${newRanking.id}-number`,
        name: `Ranking ${rankingNumber} Number`,
        content: `${rankingNumber}.`,
        color: newRanking.numberColor,
        backgroundColor: newRanking.numberBgColor,
        fontWeight: "bold",
        fontSize: 48,
        x: -400,
        y: yPosition,
        textShadow: "4px 4px 4px rgba(0, 0, 0, 1)",
        duration: 120, // Very long duration to appear throughout video
      },
      0 // Always start at time 0
    );

    // Add title element - starts after previous titles end, appears throughout video
    console.log(
      `Adding title element for Ranking ${rankingNumber} at time ${titleStartTime}s`
    );
    useTimelineStore.getState().addElementAtTime(
      {
        ...DEFAULT_TEXT_ELEMENT,
        id: `${newRanking.id}-title`,
        name: `Ranking ${rankingNumber} Title`,
        content: " ", // Use space instead of empty string to ensure element is created
        color: newRanking.titleColor,
        backgroundColor: newRanking.titleBgColor,
        fontSize: 48,
        textAlign: "left",
        x: -370,
        y: yPosition,
        textShadow: "4px 4px 4px rgba(0, 0, 0, 1)",
        duration: 120, // Long duration to appear throughout video
      },
      titleStartTime // Start after previous titles
    );
    console.log(`Title element added for Ranking ${rankingNumber}`);

    // Find the newly created elements on timeline and save their IDs
    // Find by name since IDs get regenerated by buildTextElement
    let retries = 0;
    const maxRetries = 5;
    const findElements = () => {
      const allTracks = useTimelineStore.getState().tracks;
      console.log(
        `Attempt ${retries + 1}: Looking for Ranking ${rankingNumber} elements`
      );

      let numberId: string | null = null;
      let numberTrackId: string | null = null;
      let titleId: string | null = null;
      let titleTrackId: string | null = null;

      // Find the tracks containing our elements by name and content
      for (const track of allTracks) {
        for (const element of track.elements) {
          if (element.type === "text") {
            console.log(
              `  Text element: name="${element.name}", content="${element.content}"`
            );

            // Match number element by name and content
            if (
              element.name === `Ranking ${rankingNumber} Number` &&
              element.content === `${rankingNumber}.`
            ) {
              numberId = element.id;
              numberTrackId = track.id;
              console.log(
                `  ✓ Found number element: ${numberId} in track ${track.id}`
              );
            }

            // Match title element by name
            else if (element.name === `Ranking ${rankingNumber} Title`) {
              titleId = element.id;
              titleTrackId = track.id;
              console.log(
                `  ✓ Found title element: ${titleId} in track ${track.id}`
              );
            }
          }
        }
      }

      // If all found, save to map
      if (numberId && titleId && numberTrackId && titleTrackId) {
        setTimelineElementMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(newRanking.id, {
            trackId: numberTrackId,
            numberId: numberId,
            titleId: titleId,
            titleTrackId: titleTrackId,
          });
          console.log(`✓ Successfully mapped ${newRanking.id}`);
          return newMap;
        });
        return true;
      }

      retries++;
      if (retries < maxRetries) {
        setTimeout(findElements, 50 * retries);
      } else {
        console.error(
          `Failed to find elements for ${newRanking.id} after ${maxRetries} attempts`
        );
      }
      return false;
    };

    setTimeout(findElements, 50);
  };

  const handleDeleteRanking = (id: string) => {
    setRankings(rankings.filter((r) => r.id !== id));
  };

  const handleUpdateRanking = (id: string, updates: Partial<RankingItem>) => {
    // Get current ranking before updating
    const currentRanking = rankings.find((r) => r.id === id);
    if (!currentRanking) {
      return;
    }

    const updatedRanking = { ...currentRanking, ...updates };
    const index = rankings.findIndex((r) => r.id === id);
    const rankingNumber = index + 1;

    // Update local state
    setRankings((prev) => prev.map((r) => (r.id === id ? updatedRanking : r)));

    // Update both number and title elements on timeline
    const elementInfo = timelineElementMap.get(id);
    console.log("Updating ranking:", id, "elementInfo:", elementInfo);
    console.log("Updates:", updates);

    if (elementInfo) {
      const timelineStore = useTimelineStore.getState();

      // Always update number element (in its own track)
      timelineStore.updateTextElement(
        elementInfo.trackId,
        elementInfo.numberId,
        {
          content: `${rankingNumber}.`,
          color: updatedRanking.numberColor,
          backgroundColor: updatedRanking.numberBgColor,
          fontWeight: "bold",
        }
      );

      // Always update title element (in its own track)
      timelineStore.updateTextElement(
        elementInfo.titleTrackId,
        elementInfo.titleId,
        {
          content: updatedRanking.title || " ",
          color: updatedRanking.titleColor,
          backgroundColor: updatedRanking.titleBgColor,
          textAlign: "left",
        }
      );

      // Update start times of all subsequent titles and videos when duration changes
      if (updates.duration !== undefined) {
        // Recalculate start times for all titles and videos based on new durations
        let accumulatedTime = 0;
        const updatedRankings = rankings.map((r) =>
          r.id === id ? updatedRanking : r
        );

        updatedRankings.forEach((r, idx) => {
          const rElementInfo = timelineElementMap.get(r.id);
          if (rElementInfo) {
            // Update title start time
            const titleTrack = timelineStore.tracks.find(
              (t) => t.id === rElementInfo.titleTrackId
            );
            if (titleTrack) {
              const titleElement = titleTrack.elements.find(
                (el) => el.id === rElementInfo.titleId
              );
              if (titleElement && titleElement.startTime !== accumulatedTime) {
                console.log(
                  `Updating title ${idx + 1} startTime to ${accumulatedTime}s`
                );
                timelineStore.updateElementStartTime(
                  rElementInfo.titleTrackId,
                  rElementInfo.titleId,
                  accumulatedTime
                );
              }
            }

            // Update video start time and duration if it exists
            if (rElementInfo.videoId && rElementInfo.videoTrackId) {
              const videoTrack = timelineStore.tracks.find(
                (t) => t.id === rElementInfo.videoTrackId
              );
              if (videoTrack) {
                const videoElement = videoTrack.elements.find(
                  (el) => el.id === rElementInfo.videoId
                );
                if (videoElement) {
                  // Update start time
                  if (videoElement.startTime !== accumulatedTime) {
                    console.log(
                      `Updating video ${
                        idx + 1
                      } startTime to ${accumulatedTime}s`
                    );
                    timelineStore.updateElementStartTime(
                      rElementInfo.videoTrackId,
                      rElementInfo.videoId,
                      accumulatedTime
                    );
                  }
                  // Update duration to match ranking duration
                  if (videoElement.duration !== r.duration) {
                    console.log(
                      `Updating video ${idx + 1} duration to ${r.duration}s`
                    );
                    timelineStore.updateElementDuration(
                      rElementInfo.videoTrackId,
                      rElementInfo.videoId,
                      r.duration
                    );
                  }
                }
              }
            }
          }
          accumulatedTime += r.duration;
        });
      }
    } else {
      console.log("Element info not found in map for ranking:", id);
      console.log(
        "Available keys in map:",
        Array.from(timelineElementMap.keys())
      );
    }
  };

  const handleFetchVideo = async (id: string) => {
    const ranking = rankings.find((r) => r.id === id);
    if (!ranking || !ranking.videoUrl.trim()) return;

    handleUpdateRanking(id, { isLoadingVideo: true });

    try {
      if (ranking.platform === "tiktok") {
        // Extract video ID from TikTok URL
        const videoIdMatch = ranking.videoUrl.match(/\/video\/(\d+)/);
        if (!videoIdMatch) {
          console.error("Could not extract TikTok video ID from URL");
          handleUpdateRanking(id, { isLoadingVideo: false });
          return;
        }

        const videoId = videoIdMatch[1];
        console.log(`Fetching TikTok video ID: ${videoId}`);

        // Fetch video data from API via proxy (with localhost origin)
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

        // Calculate start time for this video based on ranking position
        const index = rankings.findIndex((r) => r.id === id);
        const startTime = rankings
          .slice(0, index)
          .reduce((acc, r) => acc + r.duration, 0);

        // Check active project
        if (!activeProject) {
          console.error("No active project");
          handleUpdateRanking(id, { isLoadingVideo: false });
          return;
        }

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
        // Other platforms not implemented yet
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

      // Calculate start time for this video based on ranking position
      const index = rankings.findIndex((r) => r.id === id);
      const startTime = rankings
        .slice(0, index)
        .reduce((acc, r) => acc + r.duration, 0);

      console.log("Processing dropped video...", file.name);

      // Process video file
      const processedItems = await processMediaFiles([file], (progress) => {
        console.log(`Processing: ${progress}%`);
      });

      if (processedItems.length === 0) {
        console.error("Failed to process video");
        handleUpdateRanking(id, { isLoadingVideo: false });
        return;
      }

      const processedMedia = processedItems[0];

      // Add to media store
      const { useMediaStore } = await import("@/stores/media-store");
      await useMediaStore
        .getState()
        .addMediaFile(activeProject.id, processedMedia);

      // Find the newly added media file
      await new Promise((resolve) => setTimeout(resolve, 500));
      const freshState = useMediaStore.getState();
      const addedMediaFile = freshState.mediaFiles.find(
        (media) => media.file === file && media.type === "video"
      );

      if (!addedMediaFile) {
        console.error("Failed to find added media file");
        handleUpdateRanking(id, { isLoadingVideo: false });
        return;
      }

      console.log("Added to media library:", addedMediaFile.id);

      // Add video to timeline at correct position
      useTimelineStore.getState().addElementAtTime(addedMediaFile, startTime);

      console.log(`Added to timeline at ${startTime}s`);

      // Find and link video element to ranking item
      setTimeout(() => {
        const timelineStore = useTimelineStore.getState();
        const allTracks = timelineStore.tracks;
        let videoId: string | null = null;
        let videoTrackId: string | null = null;

        // Find the video element by mediaId
        for (const track of allTracks) {
          for (const element of track.elements) {
            if (
              element.type === "media" &&
              element.mediaId === addedMediaFile.id
            ) {
              videoId = element.id;
              videoTrackId = track.id;
              console.log(
                `Found video element: ${videoId} in track ${track.id}`
              );
              break;
            }
          }
          if (videoId) break;
        }

        // Link video to ranking item and set duration
        if (videoId && videoTrackId) {
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
            return newMap;
          });

          // Get video duration from media file
          const videoDuration = addedMediaFile.duration || 30;
          console.log(`Video duration: ${videoDuration}s`);

          // Set max duration for this ranking item
          handleUpdateRanking(id, {
            maxDuration: videoDuration,
            // If current duration exceeds video duration, cap it
            duration: Math.min(ranking.duration, videoDuration),
          });

          // Set video duration to match ranking duration (capped at video length)
          const finalDuration = Math.min(ranking.duration, videoDuration);
          timelineStore.updateElementDuration(
            videoTrackId,
            videoId,
            finalDuration
          );
          console.log(
            `Set video duration to ${finalDuration}s (capped at video length)`
          );
        }
      }, 100);

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

  const handleAddTitleToTimeline = (
    ranking: RankingItem,
    index: number,
    currentTime: number
  ) => {
    useTimelineStore.getState().addElementAtTime(
      {
        ...DEFAULT_TEXT_ELEMENT,
        id: `${ranking.id}-title`,
        name: ranking.title || `Ranking ${index + 1}`,
        content: ranking.title || `Ranking ${index + 1}`,
        color: ranking.titleColor,
        backgroundColor: ranking.titleBgColor,
      },
      currentTime
    );
  };

  return (
    <BaseView>
      <div className="space-y-4" ref={containerRef}>
        {/* Global header text */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Header Text (appears above all videos)
          </label>
          <Input
            placeholder="Enter header text for all rankings..."
            value={globalHeader}
            onChange={(e) => setGlobalHeader(e.target.value)}
            className="h-9 text-sm bg-background font-medium"
          />
        </div>

        {/* Default colors for top 3 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Default Colors for Top 3
          </label>
          <div className="flex gap-2 items-center">
            {[0, 1, 2].map((index) => (
              <Popover
                key={index}
                open={colorPickerOpen?.type === (`default${index + 1}` as any)}
                onOpenChange={(open) =>
                  setColorPickerOpen(
                    open ? { id: "", type: `default${index + 1}` as any } : null
                  )
                }
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-10 h-10 rounded-md border-2 border-border hover:scale-110 transition-transform flex items-center justify-center font-bold"
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
                    <label className="text-xs font-medium">
                      Rank {index + 1} Color
                    </label>
                    <ColorPicker
                      value={defaultColors[index].replace("#", "")}
                      onChange={(color) => {
                        const newColors: [string, string, string] = [
                          ...defaultColors,
                        ];
                        newColors[index] = `#${color}`;
                        setDefaultColors(newColors);
                      }}
                      containerRef={containerRef}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>

        {/* Add new ranking button */}
        <Button onClick={handleAddRanking} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Ranking Item
        </Button>

        {/* Rankings list */}
        {rankings.length > 0 && (
          <div className="space-y-3">
            {rankings.map((ranking, index) => (
              <div
                key={ranking.id}
                className={`bg-panel-accent rounded-lg p-3 space-y-2 border ${
                  dragOverId === ranking.id
                    ? "border-primary border-2 bg-primary/10"
                    : "border-border"
                }`}
                onDragOver={(e) => handleDragOver(e, ranking.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, ranking.id)}
              >
                {/* Header: Number with color buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-lg font-bold px-2 py-0.5 rounded"
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
                          open ? { id: ranking.id, type: "number" } : null
                        )
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-5 h-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: ranking.numberColor }}
                          aria-label="Change number color"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-2">
                          <label className="text-xs font-medium">
                            Number Color
                          </label>
                          <ColorPicker
                            value={ranking.numberColor.replace("#", "")}
                            onChange={(color) =>
                              handleUpdateRanking(ranking.id, {
                                numberColor: `#${color}`,
                              })
                            }
                            containerRef={containerRef}
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
                          open ? { id: ranking.id, type: "numberBg" } : null
                        )
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-5 h-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
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
                          <label className="text-xs font-medium">
                            Number Background
                          </label>
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
                            containerRef={containerRef}
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
                    className="h-7 w-7 ml-auto"
                    onClick={() => handleDeleteRanking(ranking.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Title input with color buttons */}
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Enter title..."
                    value={ranking.title}
                    onChange={(e) =>
                      handleUpdateRanking(ranking.id, {
                        title: e.target.value,
                      })
                    }
                    className="flex-1 h-8 text-xs"
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
                        open ? { id: ranking.id, type: "title" } : null
                      )
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-5 h-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: ranking.titleColor }}
                        aria-label="Change title color"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="end">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">
                          Title Color
                        </label>
                        <ColorPicker
                          value={ranking.titleColor.replace("#", "")}
                          onChange={(color) =>
                            handleUpdateRanking(ranking.id, {
                              titleColor: `#${color}`,
                            })
                          }
                          containerRef={containerRef}
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
                        open ? { id: ranking.id, type: "titleBg" } : null
                      )
                    }
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-5 h-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: ranking.titleBgColor }}
                        aria-label="Change title background"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="end">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">
                          Title Background
                        </label>
                        <ColorPicker
                          value={ranking.titleBgColor.replace("#", "")}
                          onChange={(color) =>
                            handleUpdateRanking(ranking.id, {
                              titleBgColor: `#${color}`,
                            })
                          }
                          containerRef={containerRef}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Add title to timeline */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      handleAddTitleToTimeline(
                        ranking,
                        index,
                        useTimelineStore.getState().dragState.currentTime
                      )
                    }
                    disabled={!ranking.title.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Duration control */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Duration: {ranking.duration}s
                    {ranking.maxDuration && ` (max: ${ranking.maxDuration}s)`}
                  </label>
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
                    className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
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
                      YouTube
                    </SelectItem>
                    <SelectItem value="tiktok" className="text-xs">
                      TikTok
                    </SelectItem>
                    <SelectItem value="instagram" className="text-xs">
                      Instagram
                    </SelectItem>
                    <SelectItem value="twitter" className="text-xs">
                      Twitter/X
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Video URL input */}
                <div className="flex gap-2">
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
                    className="h-8 px-3"
                    onClick={() => handleFetchVideo(ranking.id)}
                    disabled={
                      !ranking.videoUrl.trim() || ranking.isLoadingVideo
                    }
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {ranking.isLoadingVideo ? "Loading..." : "Add"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseView>
  );
}
