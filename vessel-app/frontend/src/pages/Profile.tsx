import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { contentService, type Video, type ActiveProfile, type FollowStats } from "../services/contentService"
import { formatLikes } from "../services/mockData"
import styles from "./Profile.module.css"

type TabKey = "videos" | "liked" | "saved"

type OverlayProps = {
  title: string
  handles: string[]
  onClose: () => void
}

const normalize = (value?: string) => (value || "").toLowerCase()

type AuthMode = "signup" | "login"

export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeProfile, setActiveProfile] = React.useState<ActiveProfile>(() => contentService.getActiveProfile())
  const targetId = id === "me" ? activeProfile.id : id || ""

  const [clips, setClips] = React.useState<Video[]>([])
  const [likedClips, setLikedClips] = React.useState<Video[]>([])
  const [savedClips, setSavedClips] = React.useState<Video[]>(() => contentService.getSavedClips())
  const [isFollowing, setIsFollowing] = React.useState(false)
  const [tab, setTab] = React.useState<TabKey>("videos")
  const [showFollowingList, setShowFollowingList] = React.useState(false)
  const [showFollowersList, setShowFollowersList] = React.useState(false)
  const [followBusy, setFollowBusy] = React.useState(false)
  const [followStats, setFollowStats] = React.useState<FollowStats | null>(null)

  React.useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setActiveProfile(contentService.getActiveProfile())
    })
    return unsubscribe
  }, [])

  React.useEffect(() => {
    setTab("videos")
  }, [targetId])
  const heroClip = clips[0] ?? likedClips[0]

  const normalizedTargetId = normalize(targetId)
  const normalizedActiveId = normalize(activeProfile.id)
  const isSelf = normalizedTargetId === normalizedActiveId && normalizedTargetId.length > 0
  const isAuthenticated = contentService.isAuthenticated()
  const isGuest = isSelf && !isAuthenticated

  const displayName = isSelf
    ? activeProfile.name || "Guest Creator"
    : heroClip?.user.name || (targetId ? targetId : "Creator")
  const defaultHandleSeed = targetId || normalize(displayName).replace(/\s+/g, "")
  const profileHandle = isSelf
    ? `@${activeProfile.id || "guest"}`
    : heroClip?.user.id
    ? `@${heroClip.user.id}`
    : `@${defaultHandleSeed}`

  const followTargetId = isSelf ? "" : heroClip?.user.id ?? targetId

  React.useEffect(() => {
    if (!targetId) return
    const refresh = () => {
      setClips(contentService.getClipsByAuthor(targetId))
      setLikedClips(contentService.getLikedFeedFor(targetId))
      if (isSelf) {
        setSavedClips(contentService.getSavedClips())
      } else {
        setSavedClips([])
      }
    }
    refresh()
    const unsubscribe = contentService.subscribe(refresh)
    return unsubscribe
  }, [targetId, isSelf])

  React.useEffect(() => {
    let cancelled = false
    async function loadProfileVideos() {
      if (!targetId) {
        setClips([])
        return
      }
      try {
        const data = isSelf
          ? await contentService.fetchMyUploads()
          : await contentService.fetchCreatorUploads(targetId)
        if (!cancelled) {
          setClips(data)
        }
      } catch (error) {
        console.error('Failed to load profile feed', error)
        if (!cancelled) {
          setClips(contentService.getClipsByAuthor(targetId))
        }
      }
    }
    void loadProfileVideos()
    return () => {
      cancelled = true
    }
  }, [targetId, isSelf])

  React.useEffect(() => {
    let cancelled = false
    if (!targetId) {
      setFollowStats(null)
      return () => {
        cancelled = true
      }
    }
    contentService
      .fetchFollowStats(targetId)
      .then((stats) => {
        if (!cancelled) {
          setFollowStats(stats)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFollowStats(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [targetId])

  React.useEffect(() => {
    if (!followTargetId) return
    setIsFollowing(contentService.isFollowing(followTargetId))
  }, [followTargetId])

  React.useEffect(() => {
    setFollowBusy(false)
  }, [followTargetId])
  React.useEffect(() => {
    if (isGuest) {
      setShowFollowersList(false)
      setShowFollowingList(false)
    }
  }, [isGuest])

  if (!targetId) {
    return <div className={styles.placeholder}>Creator not found.</div>
  }

  const totalLikes = clips.reduce((acc, clip) => acc + clip.likes, 0)
  const savedCount = savedClips.length
  const followerEstimate = isSelf && !isAuthenticated ? 0 : Math.max(120, likedClips.length ? likedClips.length * 120 : totalLikes / 18)
  const baseFollowing = contentService.listFollowingIds()
  const church = isSelf ? activeProfile.church : heroClip?.user.churchHome || ""
  const avatarPhoto = isSelf ? activeProfile.photo : undefined
  const avatarLetter = displayName.slice(0, 1).toUpperCase()

  const ensureHandle = React.useCallback((value: string) => (value.startsWith("@") ? value : `@${value}`), [])

  const followingHandles = React.useMemo(() => {
    if (isGuest) return []
    if (baseFollowing.length) return baseFollowing.map(ensureHandle)
    return Array.from({ length: 6 }, (_, i) => ensureHandle(`friend_${i + 1}`))
  }, [baseFollowing, ensureHandle, isGuest])

  const followersHandles = React.useMemo(() => {
    if (isGuest) return []
    const count = Math.min(20, Math.max(5, Math.round(followerEstimate / 250) + 5))
    return Array.from({ length: count }, (_, i) => ensureHandle(`supporter_${i + 1}`))
  }, [ensureHandle, followerEstimate, isGuest])

  const gridSource = tab === "videos" ? clips : tab === "liked" ? likedClips : savedClips
  const followingCount = followStats?.following ?? (isGuest ? 0 : followingHandles.length)
  const followerCount = followStats?.followers ?? (isGuest ? 0 : Math.round(followerEstimate))

  const handleFollowToggle = React.useCallback(async () => {
    if (!followTargetId || followBusy) return
    if (!isAuthenticated) {
      window.alert('Sign in to follow creators on Vessel.')
      return
    }
    setFollowBusy(true)
    try {
      if (isFollowing) {
        await contentService.unfollowUser(followTargetId)
        setIsFollowing(false)
      } else {
        await contentService.followUser(followTargetId)
        setIsFollowing(true)
      }
      if (targetId) {
        const stats = await contentService.fetchFollowStats(targetId)
        setFollowStats(stats)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update follow status. Please try again.'
      window.alert(message)
    } finally {
      setFollowBusy(false)
    }
  }, [followBusy, followTargetId, isFollowing, isAuthenticated, targetId])

  function copyProfileLink() {
    const shareId = targetId || activeProfile.id
    const url = `${window.location.origin}/profile/${shareId || "me"}`
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).then(() => window.alert('Profile link copied'))
    } else {
      window.open(url, '_blank')
    }
  }

  const openSettings = React.useCallback(
    (mode?: AuthMode) => {
      const search = mode ? `?mode=${mode}` : ""
      navigate(`/profile/me/settings${search}`)
    },
    [navigate]
  )

  return (
    <div className={styles.profile}>
      <header className={styles.topBar}>
        <button type="button" className={styles.topIcon} onClick={() => navigate(-1)} aria-label="Back">
          Back
        </button>
        <div className={styles.topIconGroup}>
          {isSelf ? (
            <button type="button" className={styles.heroSettingsButton} onClick={() => openSettings()}>
              Settings
            </button>
          ) : null}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.banner}>
          <div className={styles.avatar}>
            {avatarPhoto ? <img src={avatarPhoto} alt={`${displayName} avatar`} /> : avatarLetter}
          </div>
        </div>
        <div className={styles.bio}>
          <span className={styles.handle}>{profileHandle}</span>
          <h1 className={styles.displayName}>{displayName}</h1>
          {church ? <p className={styles.church}>{church}</p> : null}
        </div>
        <div className={styles.statsRow}>
          <Stat
            label="Following"
            value={followingCount.toLocaleString()}
            onClick={isGuest ? undefined : () => setShowFollowingList(true)}
            disabled={isGuest}
          />
          <Stat
            label="Followers"
            value={followerCount.toLocaleString()}
            onClick={isGuest ? undefined : () => setShowFollowersList(true)}
            disabled={isGuest}
          />
          <Stat label="Likes" value={formatLikes(totalLikes)} />
          {isSelf ? <Stat label="Saved" value={savedCount.toLocaleString()} /> : null}
        </div>
        <div className={styles.actions}>
          {isGuest ? (
            <>
              <button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                onClick={() => openSettings("signup")}
              >
                Create profile
              </button>
              <button className={styles.actionButton} onClick={() => openSettings("login")}>
                Sign in
              </button>
            </>
          ) : isSelf ? (
            <>
              <button className={`${styles.actionButton} ${styles.primaryAction}`} onClick={() => navigate('/upload')}>
                Upload
              </button>
              <button className={styles.actionButton} onClick={() => openSettings("signup")}>
                Edit profile
              </button>
              <button className={styles.actionButton} onClick={copyProfileLink}>
                Share
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                onClick={handleFollowToggle}
                disabled={followBusy}
                aria-busy={followBusy}
              >
                {followBusy ? (isFollowing ? 'Unfollowing...' : 'Following...') : isFollowing ? 'Following' : 'Follow'}
              </button>
              <button className={styles.actionButton} onClick={() => navigate('/inbox')}>
                Message
              </button>
              <button className={styles.actionButton} onClick={copyProfileLink}>
                Share
              </button>
            </>
          )}
        </div>
      </section>

      <section className={styles.gridSection}>
        <div className={styles.tabBar}>
          <button
            type="button"
            className={tab === 'videos' ? styles.tabActive : styles.tabButton}
            onClick={() => setTab('videos')}
          >
            Videos
          </button>
          <button
            type="button"
            className={tab === 'liked' ? styles.tabActive : styles.tabButton}
            onClick={() => setTab('liked')}
          >
            Liked
          </button>
          {isSelf ? (
            <button
              type="button"
              className={tab === 'saved' ? styles.tabActive : styles.tabButton}
              onClick={() => setTab('saved')}
            >
              Saved
            </button>
          ) : null}
        </div>
        <div className={styles.gridContent}>
          {gridSource.map((clip) => (
            <button
              key={`${tab}-${clip.id}`}
              type="button"
              className={styles.gridItem}
              onClick={() => navigate(`/watch/${clip.id}`)}
            >
              <video
                className={styles.gridVideo}
                src={clip.videoUrl}
                poster={clip.thumbnailUrl}
                muted
                loop
                playsInline
              />
              <div className={styles.gridOverlay}>
                <span>Likes: {formatLikes(clip.likes)}</span>
              </div>
            </button>
          ))}
          {tab === 'videos' && !clips.length ? (
            <div className={styles.emptyVideos}>
              <h3>No videos yet</h3>
              <p>When this creator uploads, their moments will appear here.</p>
            </div>
          ) : null}
          {tab === 'liked' && !likedClips.length ? (
            <div className={styles.emptyLiked}>
              <h3>No liked videos yet</h3>
              <p>Videos you like will appear here. Explore the feed and tap the heart to save your favourites.</p>
            </div>
          ) : null}
          {tab === 'saved' && !savedClips.length ? (
            <div className={styles.emptyLiked}>
              <h3>No saved videos yet</h3>
              <p>Tap Save on any Vessel moment to keep it close for future encouragement.</p>
            </div>
          ) : null}
        </div>
      </section>

      {showFollowingList && !isGuest ? (
        <Overlay title="Following" handles={followingHandles} onClose={() => setShowFollowingList(false)} />
      ) : null}
      {showFollowersList && !isGuest ? (
        <Overlay title="Followers" handles={followersHandles} onClose={() => setShowFollowersList(false)} />
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string
  value: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className={styles.stat} onClick={onClick} disabled={disabled}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </button>
  )
}

function Overlay({ title, handles, onClose }: OverlayProps) {
  return (
    <div className={styles.overlayBackdrop}>
      <div className={styles.overlayPanel}>
        <div className={styles.overlayHeader}>
          <h3 className={styles.overlayTitle}>{title}</h3>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <div className={styles.overlayList}>
          {handles.map((handle) => (
            <div key={handle} className={styles.overlayItem}>
              <div className={styles.overlayAvatar}>{handle.slice(1, 2).toUpperCase()}</div>
              <div>
                <div className={styles.overlayHandle}>{handle}</div>
                <div className={styles.overlayMeta}>Follows Jesus & Faith builder</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
