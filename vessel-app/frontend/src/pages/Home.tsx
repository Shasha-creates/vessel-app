import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { contentService, type Video, type VideoComment, type ApiUser } from '../services/contentService'
import { formatLikes } from '../services/mockData'
import { formatRelativeTime } from '../utils/time'
import { Media } from '../media'
import styles from './Home.module.css'

type TabId = 'forYou' | 'following' | 'friends' | 'live' | 'music' | 'prayer'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'music', label: 'Music' },
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'forYou', label: 'For You' },
  { id: 'prayer', label: 'Prayer' },
]
const FALLBACK_BACKDROP =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'

export default function Home() {
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const [featured, setFeatured] = React.useState<Video[]>([])
  const [comments, setComments] = React.useState<VideoComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [commentsError, setCommentsError] = React.useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const initialQuery = (searchParams.get('q') || '').trim()
  const [searchValue, setSearchValue] = React.useState(initialQuery)
  const [isCommentsOpen, setIsCommentsOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<TabId>('forYou')

  React.useEffect(() => {
    let cancelled = false
    async function loadFeed() {
      setLoading(true)
      setError(null)

      const requireAuth = activeTab === 'following' || activeTab === 'friends'
      if (requireAuth && !contentService.isAuthenticated()) {
        setFeatured([])
        setError('Sign in to view this feed.')
        setLoading(false)
        return
      }

      try {
        let feed: Video[] = []
        if (activeTab === 'following') {
          feed = await contentService.fetchFollowingFeed()
        } else if (activeTab === 'friends') {
          const [followingList, followerList] = await Promise.all([
            contentService.fetchFollowingProfiles().catch(() => []),
            contentService.fetchFollowerProfiles().catch(() => []),
          ])
          const mutualAccountIds = buildMutualAccountSet(followingList, followerList)
          const mutualHandles = buildMutualHandleSet(followingList, followerList)
          const baseFeed = await contentService.fetchFollowingFeed()
          feed = baseFeed.filter((clip) => {
            const id = normalizeValue(clip.user.accountId || clip.user.id)
            const handle = normalizeHandle(clip.user.handle || clip.user.id)
            return (id && mutualAccountIds.has(id)) || (handle && mutualHandles.has(handle))
          })
        } else {
          feed = await contentService.fetchForYouFeed()
        }
        if (!cancelled) {
          setFeatured(feed)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load this feed.'
          setError(message)
          setFeatured([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void loadFeed()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  const heroVideo = featured[0] ?? null
  const heroBackground = heroVideo?.thumbnailUrl || FALLBACK_BACKDROP

  React.useEffect(() => {
    if (!isCommentsOpen || !heroVideo) {
      return
    }
    let cancelled = false
    setCommentsLoading(true)
    setCommentsError(null)
    contentService
      .fetchClipComments(heroVideo.id)
      .then((data) => {
        if (!cancelled) {
          setComments(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load comments.'
          setCommentsError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [heroVideo, isCommentsOpen])

  const searchResults = React.useMemo(() => {
    const normalized = searchValue.trim().toLowerCase()
    if (!normalized) {
      return []
    }
    return featured.filter((clip) => {
      const haystack = [
        clip.title,
        clip.description,
        clip.user.name,
        clip.user.id,
        clip.category,
        clip.tags?.join(' ') ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [featured, searchValue])

  const likesDisplay = heroVideo?.likesDisplay ?? formatLikes(heroVideo?.likes ?? 0)
  const commentsDisplay = formatLikes(heroVideo?.comments ?? comments.length)
  const savesDisplay = formatLikes(heroVideo?.bookmarks ?? 0)

  return (
    <div className={styles.home}>
      <div className={styles.backdrop} style={{ backgroundImage: `url(${heroBackground})` }} />
      <div className={styles.backdropOverlay} />

      <div className={styles.screen}>
        <div className={styles.headerRow}>
          <div className={styles.tabHeader}>
            <div className={styles.tabLogo}>
              <img src={Media.icons.logo} alt="Godlyme" />
            </div>
            <div className={styles.tabGroup}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.searchButton}
            onClick={() => searchInputRef.current?.focus()}
          >
            🔍
          </button>
        </div>

        <div className={styles.searchBar}>
          <span aria-hidden="true">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search creators, testimonies, verses…"
          />
          {searchValue ? (
            <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
              ✕
            </button>
          ) : null}
        </div>
        {searchValue ? (
          <div className={styles.inlineResults}>
            {loading ? (
              <p>Gathering the latest moments…</p>
            ) : error ? (
              <p className={styles.searchError}>{error}</p>
            ) : searchResults.length ? (
              searchResults.slice(0, 5).map((clip) => (
                <Link key={clip.id} to={`/watch/${clip.id}`} className={styles.resultItem}>
                  <strong>{clip.title}</strong>
                  <span>{clip.user.name}</span>
                </Link>
              ))
            ) : (
              <p>No matching clips yet. Try another keyword.</p>
            )}
          </div>
        ) : null}

        <div className={styles.contentRow}>
          <div className={styles.videoMeta}>
            <div className={styles.creatorRow}>
              <div className={styles.creatorAvatar}>
                {heroVideo ? heroVideo.user.name.slice(0, 1).toUpperCase() : '?'}
              </div>
              <div>
                <p className={styles.creatorHandle}>
                  {heroVideo ? `@${heroVideo.user.id}` : '@creator'}
                  <span className={styles.creatorChurch}>
                    {heroVideo?.user.churchHome || heroVideo?.user.ministryRole || 'Vessel Community'}
                  </span>
                </p>
                <p className={styles.creatorName}>{heroVideo?.user.name ?? 'Featured Creator'}</p>
              </div>
              <button type="button" className={styles.followButton}>
                Follow
              </button>
            </div>
            <p className={styles.videoCategory}>{heroVideo?.category?.toUpperCase() ?? 'WORSHIP'}</p>
            <h1 className={styles.videoTitle}>{heroVideo?.title ?? 'Sunrise Worship Session'}</h1>
            <p className={styles.videoDescription}>{heroVideo?.description ?? 'An intimate moment of worship.'}</p>
            <p className={styles.videoDescription}>
              {heroVideo?.scripture?.reference ?? 'Psalms 113:3'}
            </p>
          </div>

          <div className={styles.actionRail}>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="likes">
                🤍
              </span>
              <small>{likesDisplay}</small>
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setIsCommentsOpen(true)}
              disabled={!heroVideo}
            >
              <span role="img" aria-label="comments">
                💬
              </span>
              <small>{commentsDisplay}</small>
            </button>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="saves">
                🔖
              </span>
              <small>{savesDisplay}</small>
            </button>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="gift">
                🎁
              </span>
            </button>
          </div>
        </div>

      </div>

      {isCommentsOpen ? (
        <div className={styles.commentsOverlay} role="dialog" aria-modal="true">
          <div className={styles.commentsPanel}>
            <div className={styles.commentsHeader}>
              <div>
                <p>Comments</p>
                <strong>{commentsDisplay}</strong>
              </div>
              <button type="button" onClick={() => setIsCommentsOpen(false)} aria-label="Close comments">
                ✕
              </button>
            </div>
            <div className={styles.commentsBody}>
              {commentsLoading ? (
                <p>Loading conversation…</p>
              ) : commentsError ? (
                <p className={styles.commentsError}>{commentsError}</p>
              ) : comments.length ? (
                comments.map((comment) => (
                  <div key={comment.id} className={styles.commentRow}>
                    <div className={styles.commentAvatar}>{comment.user.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <p className={styles.commentMeta}>
                        <span>@{comment.user.id}</span>
                        <span>{formatRelativeTime(comment.createdAt)}</span>
                      </p>
                      <p>{comment.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>Be the first to encourage this creator.</p>
              )}
            </div>
            <div className={styles.commentComposer}>
              <input type="text" placeholder="Add a comment…" disabled />
              <button type="button" disabled>
                ⬆️
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function normalizeValue(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function normalizeHandle(value?: string | null): string {
  if (!value) return ''
  return value.trim().replace(/^@/, '').toLowerCase()
}

function buildMutualAccountSet(following: ApiUser[], followers: ApiUser[]): Set<string> {
  const followerIds = new Set(followers.map((user) => normalizeValue(user.id)))
  const intersection = new Set<string>()
  following.forEach((user) => {
    const normalized = normalizeValue(user.id)
    if (normalized && followerIds.has(normalized)) {
      intersection.add(normalized)
    }
  })
  return intersection
}

function buildMutualHandleSet(following: ApiUser[], followers: ApiUser[]): Set<string> {
  const followerHandles = new Set(followers.map((user) => normalizeHandle(user.handle || user.id)))
  const intersection = new Set<string>()
  following.forEach((user) => {
    const normalized = normalizeHandle(user.handle || user.id)
    if (normalized && followerHandles.has(normalized)) {
      intersection.add(normalized)
    }
  })
  return intersection
}
