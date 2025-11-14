import React from "react"
import { formatLikes } from "../services/mockData"
import type { Video } from "../services/contentService"
import styles from "./VideoCard.module.css"
import { BookmarkIcon, CommentIcon, DonateIcon, ShareIcon, ThumbIcon, VolumeIcon } from "./icons"

type Props = {
  video: Video
  isBookmarked?: boolean
  isFollowing?: boolean
  isActive?: boolean
  onLike?: (clip: Video) => void
  onComment?: (clip: Video) => void
  onBookmark?: (clip: Video) => void
  onShare?: (clip: Video) => void
  onDonate?: (clip: Video) => void
  onFollow?: (clip: Video) => void
  onAuthorClick?: (clip: Video) => void
  followBusy?: boolean
}

export default function VideoCard({
  video,
  isBookmarked = false,
  isFollowing = false,
  isActive = false,
  onLike,
  onComment,
  onBookmark,
  onShare,
  onDonate,
  onFollow,
  onAuthorClick,
  followBusy = false,
}: Props) {
  const likes = video.likesDisplay ?? formatLikes(video.likes)
  const scripture = video.scripture
  const tags = video.tags.slice(0, 3)
<<<<<<< HEAD
  const handle = video.user.id ? `@${video.user.id.replace(/\s+/g, "").toLowerCase()}` : `@${slugify(video.user.name)}`
=======
  const baseHandle = video.user.handle || video.user.id || ''
  const normalizedHandle =
    baseHandle.replace(/^@/, '').replace(/\s+/g, '').toLowerCase() || slugify(video.user.name)
  const handle = `@${normalizedHandle}`
>>>>>>> 8a33d6a (UI Changes)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [muted, setMuted] = React.useState(false)
  const [expandDescription, setExpandDescription] = React.useState(false)
  const DESCRIPTION_PREVIEW_LIMIT = 20
  React.useEffect(() => {
    setExpandDescription(false)
  }, [video.id])
  const descriptionText = video.description ?? ""
  const shouldClampDescription = descriptionText.length > DESCRIPTION_PREVIEW_LIMIT
  const displayDescription =
    expandDescription || !shouldClampDescription
      ? descriptionText
      : `${descriptionText.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()}...`

  React.useEffect(() => {
    const node = videoRef.current
    if (!node) return
    const shouldMute = muted || !isActive
    node.muted = shouldMute
    node.volume = shouldMute ? 0 : 1

    if (isActive) {
      const playPromise = node.play()
      if (!shouldMute && playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          node.muted = true
          setMuted(true)
        })
      }
    } else {
      node.pause()
      try {
        node.currentTime = 0
      } catch {
        // ignore reset failures on certain browsers
      }
    }
  }, [isActive, muted])

  const soundLabel = "Sound"
  const soundCount = "On"

  const actions: Array<{
    key: string
    icon: React.ReactNode
    count: string
    label: string
    onClick?: (clip: Video) => void
    active?: boolean
  }> = [
    {
      key: "sound",
      icon: <VolumeIcon muted={false} width={22} height={22} />,
      count: soundCount,
      label: soundLabel,
      active: true,
    },
    { key: "like", icon: <ThumbIcon width={22} height={22} />, count: likes, label: "Likes", onClick: onLike },
    {
      key: "comment",
      icon: <CommentIcon width={22} height={22} />,
      count: formatCount(video.comments ?? 0),
      label: "Comments",
      onClick: onComment,
    },
    {
      key: "save",
      icon: <BookmarkIcon width={22} height={22} />,
      count: formatCount(video.bookmarks ?? 0),
      label: isBookmarked ? "Saved" : "Save",
      onClick: onBookmark,
      active: isBookmarked,
    },
    {
      key: "donate",
      icon: <DonateIcon width={22} height={22} />,
      count: formatCount(video.donations ?? 0),
      label: "Donate",
      onClick: onDonate,
    },
    {
      key: "share",
      icon: <ShareIcon width={22} height={22} />,
      count: formatCount(video.shares ?? 0),
      label: "Share",
      onClick: onShare,
    },
  ]

  return (
    <article className={styles.card}>
      <video
        ref={videoRef}
        className={styles.video}
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        autoPlay
        loop
        muted={muted || !isActive}
        playsInline
      />
      <div className={styles.overlay}>
        <div className={styles.topMeta}>
          <button
            type="button"
            className={styles.avatar}
            onClick={() => onAuthorClick?.(video)}
            aria-label={`Open profile for ${video.user.name}`}
          >
            {video.user.name.slice(0, 1).toUpperCase()}
          </button>
          <button type="button" className={styles.profileInfo} onClick={() => onAuthorClick?.(video)}>
            <span className={styles.handle}>{handle}</span>
            {video.user.churchHome && <span className={styles.church}>{video.user.churchHome}</span>}
          </button>
          {onFollow ? (
            <button
              type="button"
              className={`${styles.followButton} ${isFollowing ? styles.followButtonActive : ""}`}
              onClick={() => onFollow(video)}
              aria-pressed={isFollowing}
              disabled={followBusy}
              aria-busy={followBusy}
            >
              {followBusy ? (isFollowing ? "Unfollowing..." : "Following...") : isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>
        <span className={styles.category}>{video.category}</span>
        <h3 className={styles.title}>{video.title}</h3>
        {descriptionText ? (
          <div className={styles.descriptionBlock}>
            <p className={styles.description}>{displayDescription}</p>
            {shouldClampDescription ? (
              <button
                type="button"
                className={styles.descriptionToggle}
                onClick={() => setExpandDescription((value) => !value)}
              >
                {expandDescription ? "See less" : "See more"}
              </button>
            ) : null}
          </div>
        ) : null}
        {scripture ? (
          <div className={styles.scripture}>
            {scripture.book} {scripture.chapter}:{scripture.verses}
          </div>
        ) : null}
        {tags.length ? (
          <div className={styles.tagRow}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.actions}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`${styles.actionButton} ${action.active ? styles.actionButtonActive : ""}`}
            onClick={() => action.onClick?.(video)}
            aria-label={`${action.label} for ${video.title}`}
          >
            <span className={styles.actionIcon} aria-hidden="true">
              {action.icon}
            </span>
            <span className={styles.actionCount}>{action.count}</span>
          </button>
        ))}
      </div>
      <span className={styles.duration}>{formatDuration(video.durationSec)}</span>
    </article>
  )
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "creator"
  )
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds) return "Live"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatCount(value: number) {
  if (!value) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `${value}`
}
<<<<<<< HEAD

=======
>>>>>>> 8a33d6a (UI Changes)
