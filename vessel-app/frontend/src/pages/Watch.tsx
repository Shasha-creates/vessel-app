import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { contentService, type Video, type VideoComment } from '../services/contentService'
import { formatLikes } from '../services/mockData'
import { formatRelativeTime } from '../utils/time'
import styles from './Watch.module.css'

export default function Watch() {
  const { id } = useParams()
  const [clip, setClip] = useState<Video | undefined>(undefined)
  const [comments, setComments] = useState<VideoComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentBusy, setCommentBusy] = useState(false)
  const [text, setText] = useState('')

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

  return (
    <div className={styles.watch}>
      <section className={styles.playerSection}>
        <video
          className={styles.player}
          src={clip.videoUrl}
          controls
          poster={clip.thumbnailUrl}
        />
        <div className={styles.playerMeta}>
          <div>
            <h1 className={styles.title}>{clip.title}</h1>
            <p className={styles.author}>
              <span>{clip.user.name}</span>
              {clip.user.churchHome && <span className={styles.church}>{clip.user.churchHome}</span>}
            </p>
          </div>
          <div className={styles.likes}>Likes {likes}</div>
        </div>
        <p className={styles.description}>{clip.description}</p>
        {clip.scripture && (
          <div className={styles.scripture}>
            <h3>Scripture Focus</h3>
            <p>
              {clip.scripture.book} {clip.scripture.chapter}:{clip.scripture.verses}
              {clip.scripture.translation ? ` (${clip.scripture.translation})` : ''}
            </p>
            {clip.scripture.summary && <p className={styles.scriptureSummary}>{clip.scripture.summary}</p>}
          </div>
        )}
      </section>

      <section className={styles.comments}>
        <h2>Prayer & Encouragement</h2>
        <div className={styles.commentList}>
          {loadingComments ? <div className={styles.commentStatus}>Loading comments...</div> : null}
          {commentsError ? <div className={`${styles.commentStatus} ${styles.commentError}`}>{commentsError}</div> : null}
          {!loadingComments && !commentsError && !comments.length ? (
            <div className={styles.empty}>Be the first to share a prayer or encouragement.</div>
          ) : null}
          {comments.map((comment) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <div className={styles.commentAvatar}>
                  {(comment.user.name || 'Friend').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className={styles.commentAuthor}>{comment.user.name}</div>
                  <div className={styles.commentMeta}>
                    {comment.user.handle ? `@${comment.user.handle}` : 'Verified listener'} ·{' '}
                    {formatRelativeTime(comment.createdAt)}
                  </div>
                </div>
              </div>
              <p className={styles.commentBody}>{comment.body}</p>
            </div>
          ))}
        </div>
        <div className={styles.commentComposer}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share a prayer or encouragement"
          />
          <button type="button" onClick={addComment} disabled={!text.trim() || commentBusy}>
            {commentBusy ? 'Posting...' : 'Post'}
          </button>
        </div>
      </section>
    </div>
  )
}
