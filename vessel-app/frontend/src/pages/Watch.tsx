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
import { ShareIcon, ProvidedLikeIcon } from '../shared/icons'
import { SvgComments, SvgBookmark } from '../shared/icons'
import styles from './Watch.module.css'

export default function Watch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [clip, setClip] = useState<Video | undefined>(undefined)
  const [comments, setComments] = useState<VideoComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)
  const [text, setText] = useState('')
  const [showComments, setShowComments] = useState(false)

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
  }

  return (
    <div className={styles.watch}>
      <div className={styles.viewer}>
        <video
          className={styles.player}
          src={clip.videoUrl || VIDEO_PLACEHOLDER}
          poster={clip.thumbnailUrl || THUMBNAIL_PLACEHOLDER}
          controls
          playsInline
        />
        <div className={styles.actionsRail}>
          <button type="button" onClick={toggleLike} aria-pressed={isLiked} data-key="like" className={isLiked ? undefined : undefined}>
            <ProvidedLikeIcon width={28} height={28} />
            <span>{likes}</span>
          </button>
          <button type="button" onClick={() => setShowComments(true)}>
            <SvgComments width={28} height={28} />
            <span>{comments.length}</span>
          </button>
          <button type="button" onClick={toggleBookmark} aria-pressed={isBookmarked}>
            <SvgBookmark width={28} height={28} />
            <span>{clip.bookmarks ?? 0}</span>
          </button>
          <button type="button" onClick={shareClip}>
            <ShareIcon width={28} height={28} />
            <span>Share</span>
          </button>
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
                ×
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
                        {comment.user.handle ? `@${comment.user.handle}` : 'listener'} · {formatRelativeTime(comment.createdAt)}
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
