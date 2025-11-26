import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  contentService,
  type Video,
  type VideoComment,
  THUMBNAIL_PLACEHOLDER,
  VIDEO_PLACEHOLDER,
} from '../services/contentService'
import { formatLikes } from '../services/mockData'
import { formatRelativeTime } from '../utils/time'
import {
  ShareIcon,
  ProvidedLikeIcon,
  DonateIcon,
  PlayIcon,
  PauseIcon,
  SvgComments,
  SvgBookmark,
  SvgVolume,
  SvgMute,
} from '../shared/icons'
import styles from './Watch.module.css'

export default function Watch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [clip, setClip] = useState<Video | undefined>(undefined)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [comments, setComments] = useState<VideoComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)
  const [text, setText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [muted, setMuted] = useState(true)

  const likes = useMemo(() => {
    if (!clip) return '0'
    return clip.likesDisplay ?? formatLikes(clip.likes)
  }, [clip])

  useEffect(() => {
    if (!id) return
    const video = contentService.getClipById(id)
    setClip(video)
    let cancelled = false
    setLoadingComments(true)
    setCommentsError(null)
    contentService
      .fetchClipComments(id)
      .then((list) => {
        if (!cancelled) {
          setComments(list)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load comments for this video.'
          setCommentsError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingComments(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    setMuted(true)
    const player = videoRef.current
    if (!player) return
    player
      .play()
      .then(() => {
        player.muted = true
        player.volume = 0
        setIsPlaying(!player.paused)
      })
      .catch(() => setIsPlaying(!player.paused))
  }, [clip])

  useEffect(() => {
    const player = videoRef.current
    if (!player) return
    player.muted = muted
    player.volume = muted ? 0 : 1
    if (isPlaying) {
      player.play().catch(() => setIsPlaying(!player.paused))
    } else {
      player.pause()
    }
  }, [muted, isPlaying])

  if (!clip) {
    return <div className={styles.missing}>We couldn't find that Vessel moment.</div>
  }

  const isLiked = contentService.isLiked(clip.id)
  const isBookmarked = contentService.isBookmarked(clip.id)

  async function addComment() {
    if (!id || !text.trim() || commentBusy) return
    setCommentBusy(true)
    try {
      const comment = await contentService.recordComment(id, text.trim())
      setComments((prev) => [comment, ...prev])
      setText('')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not post your encouragement. Please try again shortly.'
      window.alert(message)
    } finally {
      setCommentBusy(false)
    }
  }

  async function toggleLike() {
    if (!clip) return
    try {
      const result = await contentService.recordLike(clip.id)
      setClip((current) =>
        current ? { ...current, likes: result.count, likesDisplay: formatLikes(result.count) } : current
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not update your like. Please try again.'
      window.alert(message)
    }
  }

  function toggleBookmark() {
    if (!clip) return
    try {
      const next = contentService.toggleBookmark(clip.id)
      setClip((current) =>
        current
          ? {
              ...current,
              bookmarks: Math.max(0, (current.bookmarks ?? 0) + (next ? 1 : -1)),
            }
          : current
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in to save this video.'
      window.alert(message)
    }
  }

  function shareClip() {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/watch/${clip.id}` : `/watch/${clip.id}`
    contentService.recordShare(clip.id)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      navigator.share({ title: clip.title, url: shareUrl }).catch(() => {
        window.open(shareUrl, '_blank')
      })
    } else if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(shareUrl).catch(() => {
        window.open(shareUrl, '_blank')
      })
    } else {
      window.open(shareUrl, '_blank')
    }
    setClip((current) => (current ? { ...current, shares: (current.shares ?? 0) + 1 } : current))
  }

  function handleGift() {
    if (!clip) return
    contentService.recordDonation(clip.id, 1)
    setClip((current) => (current ? { ...current, donations: (current.donations ?? 0) + 1 } : current))
  }

  function handlePlayToggle() {
    const player = videoRef.current
    if (!player) return
    if (player.paused) {
      player.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(!player.paused))
    } else {
      player.pause()
      setIsPlaying(false)
    }
  }

  const actions = [
    {
      key: 'play',
      icon: isPlaying ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />,
      count: '',
      label: isPlaying ? 'Pause' : 'Play',
      onClick: handlePlayToggle,
      active: isPlaying,
      ariaPressed: isPlaying,
    },
    {
      key: 'sound',
      icon: muted ? <SvgMute width={22} height={22} /> : <SvgVolume width={22} height={22} />,
      count: muted ? 'Off' : 'On',
      label: 'Sound',
      onClick: () => setMuted((value) => !value),
      active: !muted,
      ariaPressed: !muted,
    },
    {
      key: 'like',
      icon: <ProvidedLikeIcon width={22} height={22} />,
      count: likes,
      label: 'Likes',
      onClick: toggleLike,
      active: isLiked,
      ariaPressed: isLiked,
    },
    {
      key: 'comment',
      icon: <SvgComments width={22} height={22} />,
      count: comments.length.toString(),
      label: 'Comments',
      onClick: () => setShowComments(true),
    },
    {
      key: 'save',
      icon: <SvgBookmark width={22} height={22} />,
      count: (clip.bookmarks ?? 0).toString(),
      label: 'Save',
      onClick: toggleBookmark,
      active: isBookmarked,
      ariaPressed: isBookmarked,
    },
    {
      key: 'donate',
      icon: <DonateIcon width={22} height={22} />,
      count: (clip.donations ?? 0).toString(),
      label: 'Gift',
      onClick: handleGift,
    },
    {
      key: 'share',
      icon: <ShareIcon width={22} height={22} />,
      count: (clip.shares ?? 0).toString(),
      label: 'Share',
      onClick: shareClip,
    },
  ]

  return (
    <div className={styles.watch}>
      <div className={styles.viewer}>
        <video
          ref={videoRef}
          className={styles.player}
          src={clip.videoUrl || VIDEO_PLACEHOLDER}
          poster={clip.thumbnailUrl || THUMBNAIL_PLACEHOLDER}
          autoPlay
          muted={muted}
          playsInline
          loop
          controls={false}
        />
        <div className={styles.actionsRail}>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              data-key={action.key}
              className={`${styles.actionButton} ${action.active ? styles.actionButtonActive : ''}`}
              onClick={action.onClick}
              aria-label={action.label}
              aria-pressed={action.ariaPressed}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                {action.icon}
              </span>
              <span className={styles.actionCount}>{action.count}</span>
            </button>
          ))}
        </div>
        <div className={styles.meta}>
          <div className={styles.metaHeader}>
            <button
              type="button"
              className={styles.avatar}
              onClick={() => navigate(`/profile/${clip.user.handle || clip.user.id || ''}`)}
            >
              {clip.user.name.slice(0, 1).toUpperCase()}
            </button>
            <div>
              <p className={styles.handle}>@{clip.user.handle || clip.user.id || 'creator'}</p>
              {clip.user.churchHome ? <p className={styles.church}>{clip.user.churchHome}</p> : null}
            </div>
          </div>
          <div className={styles.copy}>
            <p className={styles.category}>{clip.category?.toUpperCase()}</p>
            <h1 className={styles.title}>{clip.title}</h1>
            <p className={styles.description}>{clip.description}</p>
            {clip.scripture ? (
              <p className={styles.scripture}>
                {clip.scripture.book} {clip.scripture.chapter}:{clip.scripture.verses}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showComments ? (
        <div className={styles.commentsOverlay}>
          <div className={styles.commentsSheet}>
            <div className={styles.commentsHeader}>
              <span className={styles.commentCount}>
                {comments.length ? `${comments.length.toLocaleString()} comments` : 'Comments'}
              </span>
              <button type="button" className={styles.close} onClick={() => setShowComments(false)} aria-label="Close comments">
                ✕
              </button>
            </div>
            <div className={styles.commentList}>
              {loadingComments ? <div className={styles.commentStatus}>Loading comments...</div> : null}
              {commentsError ? <div className={`${styles.commentStatus} ${styles.commentError}`}>{commentsError}</div> : null}
              {!loadingComments && !commentsError && !comments.length ? (
                <div className={styles.empty}>Be the first to share a prayer or encouragement.</div>
              ) : null}
              {comments.map((comment) => (
                <div key={comment.id} className={styles.comment}>
                  <div className={styles.commentAvatar}>{(comment.user.name || 'Friend').slice(0, 1).toUpperCase()}</div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentTop}>
                      <span className={styles.commentAuthor}>{comment.user.name}</span>
                        <span className={styles.commentMeta}>
                          {comment.user.handle ? `@${comment.user.handle}` : 'listener'} • {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p>{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.commentComposer}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment..."
              />
              <button type="button" onClick={addComment} disabled={!text.trim() || commentBusy}>
                {commentBusy ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatCount(value: number) {
  if (!value) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${value}`
}
