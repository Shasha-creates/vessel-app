import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contentService, type ContentCategory } from '../services/contentService'
import styles from './Upload.module.css'

const categories: { value: ContentCategory; label: string }[] = [
  { value: 'testimony', label: 'Testimony' },
  { value: 'devotional', label: 'Devotional' },
  { value: 'worship', label: 'Worship Moment' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'prayer', label: 'Prayer' },
]

export default function Upload() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<ContentCategory>('testimony')
  const [tags, setTags] = useState('hope, encouragement')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      alert('Pick a video to share with the Vessel community.')
      return
    }

    try {
      await contentService.createUpload({
        title: title || 'Untitled Testimony',
        description,
        file,
        category,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      setError(null)
      nav('/')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to upload right now. Please double-check your details and try again.'
      setError(message)
      if (message.toLowerCase().includes('sign in')) {
        window.setTimeout(() => {
          nav('/profile/me/settings?mode=signup')
        }, 400)
      }
    }
  }

  return (
    <div className={styles.upload}>
      <h1>Share a Vessel Moment</h1>
      <p className={styles.subtitle}>
        Encourage the community with what God is doing. Short testimonies, scripture reflections, and worship sessions
        are all welcome.
      </p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Romans 8 encouragement" />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share the story or context behind this moment."
            rows={4}
          />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ContentCategory)}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className={styles.fileInput}>
          <span>Upload video</span>
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <div className={styles.actions}>
          <button type="submit">Upload to Vessel (mock)</button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>
    </div>
  )
}
