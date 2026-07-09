import Image from "next/image";
import type { GuideDefinition } from "@/lib/guides/types";
import { TikTokLayout } from "./tiktok-layout";

function PlatformLogo({
	domain,
	className = "size-4",
}: {
	domain: string;
	className?: string;
}) {
	return (
		<Image
			src={`https://cdn.brandfetch.io/${domain}/w/64/h/64`}
			alt=""
			width={18}
			height={18}
			className={className}
			draggable={false}
			unoptimized
		/>
	);
}

function PlatformGuidePreview({ domain }: { domain: string }) {
	return <PlatformLogo domain={domain} />;
}

function platformGuide({
	id,
	label,
	domain,
}: {
	id: string;
	label: string;
	domain: string;
}): GuideDefinition {
	return {
		id,
		label,
		renderPreview: () => <PlatformGuidePreview domain={domain} />,
		renderTriggerIcon: () => <PlatformLogo domain={domain} />,
		renderOverlay: () => null,
	};
}

export const tiktokGuide: GuideDefinition = {
	...platformGuide({ id: "tiktok", label: "TikTok", domain: "tiktok.com" }),
	renderOverlay: () => <TikTokLayout />,
};
export const igReelsGuide: GuideDefinition = {
	...platformGuide({ id: "ig-reels", label: "Reels", domain: "instagram.com" }),
	renderOverlay: () => (
		<div className="absolute inset-0 pointer-events-none">
			<Image
				src="/platform-guides/instagram-reel-blueprint.png"
				alt="Instagram Reel layout guide"
				className="absolute inset-0 w-full h-full object-contain"
				draggable={false}
				fill
			/>
		</div>
	),
};

export const ytShortsGuide: GuideDefinition = {
	...platformGuide({ id: "yt-shorts", label: "Shorts", domain: "youtube.com" }),
	renderOverlay: () => (
		<div className="absolute inset-0 pointer-events-none">
			<Image
				src="/platform-guides/youtubeshort-blueprint.png"
				alt="YouTube Short layout guide"
				className="absolute inset-0 w-full h-full object-contain"
				draggable={false}
				fill
			/>
		</div>
	),
};

export const spotlightGuide = platformGuide({
	id: "spotlight",
	label: "Spotlight",
	domain: "snapchat.com",
});
