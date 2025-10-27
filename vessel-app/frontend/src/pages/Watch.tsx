import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { contentService, type Video } from '../services/contentService'
import { formatLikes } from '../services/mockData'
import styles from './Watch.module.css'

function getCommentsKey(id: string) {
  return `vessel_comments_${id}`
}

export default function Watch() {
  const { id } = useParams()
  const [clip, setClip] = useState<Video | undefined>(undefined)
  const [comments, setComments] = useState<string[]>([])
  const [text, setText] = useState('')

  const likes = useMemo(() => {
    if (!clip) return '0'
    return clip.likesDisplay ?? formatLikes(clip.likes)
  }, [clip])

  useEffect(() => {
    if (!id) return
    const video = contentService.getClipById(id)
    setClip(video)
    const saved = window.localStorage.getItem(getCommentsKey(id))
    setComments(saved ? JSON.parse(saved) : [])
  }, [id])

  if (!clip) {
    return <div className={styles.missing}>We couldn't find that Vessel moment.</div>
  }
  function addComment() {
    if (!id || !text.trim()) return
    const next = [...comments, text.trim()]
    setComments(next)
    window.localStorage.setItem(getCommentsKey(id), JSON.stringify(next))
    contentService.recordComment(id)
    setText('')
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
          {comments.map((c, i) => (
            <div key={i} className={styles.comment}>
              {c}
            </div>
          ))}
          {!comments.length && <div className={styles.empty}>Be the first to share a prayer or encouragement.</div>}
        </div>
        <div className={styles.commentComposer}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share a prayer or encouragement"
          />
          <button type="button" onClick={addComment}>
            Post
          </button>
        </div>
      </section>
    </div>
  )
}
