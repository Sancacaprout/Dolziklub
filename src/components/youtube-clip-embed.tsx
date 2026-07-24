import {
  youtubePrivacyEmbedUrl,
  youtubeWatchUrl,
} from "@/lib/youtube-video";

export function YouTubeClipEmbed({
  videoId,
  title = "Clip préféré",
}: {
  videoId: string;
  title?: string;
}) {
  return (
    <div className="favorite-clip-player">
      <iframe
        src={youtubePrivacyEmbedUrl(videoId)}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
        Ouvrir sur YouTube ↗
      </a>
    </div>
  );
}
