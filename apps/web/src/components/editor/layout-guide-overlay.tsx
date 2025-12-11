"use client";

import { useEditorStore } from "@/stores/editor-store";
import Image from "next/image";

function TikTokGuide() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Image
        src="/platform-guides/tiktok-blueprint.png"
        alt="TikTok layout guide"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
        fill
      />
    </div>
  );
}

function YoutubeShortGuide() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Image
        src="/platform-guides/youtubeShort-blueprint.png"
        alt="YouTube Short layout guide"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
        fill
      />
    </div>
  );
}

function InstagramReelGuide() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Image
        src="/platform-guides/instagram-reel-blueprint.png"
        alt="Instagram Reel layout guide"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
        fill
      />
    </div>
  );
}

export function LayoutGuideOverlay() {
  const { layoutGuide } = useEditorStore();

  if (layoutGuide.platform === null) return null;
  if (layoutGuide.platform === "tiktok") return <TikTokGuide />;
  if (layoutGuide.platform === "youtubeShort") return <YoutubeShortGuide />;
  if (layoutGuide.platform === "instagramReel") return <InstagramReelGuide />;

  return null;
}
