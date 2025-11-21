import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ForYou from './ForYou'
import Following from './Following'
import Friends from './Friends'
import styles from './Feed.module.css'
import type { Video } from '../services/contentService'
import { Media } from '../media'
import { SearchIcon } from '../shared/icons'

<<<<<<< HEAD
type TabKey = 'live' | 'music' | 'following' | 'friends' | 'forYou' | 'prayer'
=======
type TabKey = 'following' | 'forYou' | 'prayer'
>>>>>>> 3c67263c8a15b3775da6bdd15e6fbc58fd100a88

const tabs: Array<{
  id: TabKey
  label: string
  filter?: (clip: Video) => boolean
}> = [
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'forYou', label: 'For You' },
  { id: 'prayer', label: 'Prayer', filter: () => false },
]

export default function Feed() {
<<<<<<< HEAD
  const location = useLocation()
  const initialTab: TabKey = location.pathname === '/friends' ? 'friends' : 'forYou'
  const [tab, setTab] = React.useState<TabKey>(initialTab)
=======
  const [tab, setTab] = React.useState<TabKey>('forYou')
  const [refreshToken, setRefreshToken] = React.useState(0)
>>>>>>> 3c67263c8a15b3775da6bdd15e6fbc58fd100a88
  const navigate = useNavigate()
  const handleSearch = React.useCallback(() => {
    const input = window.prompt(
      'Search Godlyme for creators, testimonies, prayer topics, or verses.\nTip: start with "@" to jump directly to a creator handle.'
    )
    if (!input) {
      return
    }
    const trimmed = input.trim()
    if (!trimmed) {
      return
    }
    if (trimmed.startsWith('@')) {
      const handle = trimmed.slice(1).trim()
      if (handle) {
        navigate(`/profile/${handle}`)
      }
      return
    }
    navigate(`/home?q=${encodeURIComponent(trimmed)}`)
  }, [navigate])

<<<<<<< HEAD
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs.find((item) => item.id === 'forYou') ?? tabs[0]
  const isFriends = tab === 'friends'

  React.useEffect(() => {
    if (location.pathname === '/friends') {
      setTab('friends')
    } else if (tab === 'friends') {
      setTab('forYou')
    }
  }, [location.pathname, tab])
=======
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[1]
  const handleLogoRefresh = React.useCallback(() => {
    setTab('forYou')
    setRefreshToken((token) => token + 1)
  }, [])
>>>>>>> 3c67263c8a15b3775da6bdd15e6fbc58fd100a88

  return (
    <div className={styles.feed}>
      <div className={styles.topChrome}>
        <div className={styles.topBar}>
          <div className={styles.tabHeader}>
            <div className={styles.leftTray}>
              <button
                type="button"
                className={styles.brandGlyphButton}
                aria-label="Refresh For You feed"
                onClick={handleLogoRefresh}
              >
                <img src={Media.icons.logo} alt="Godlyme" className={styles.brandGlyph} />
              </button>
              <div className={styles.tabRail}>
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={tab === item.id ? `${styles.tabButton} ${styles.tabButtonActive}` : styles.tabButton}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.statusIcons}>
              <button type="button" aria-label="Search" onClick={handleSearch}>
                <SearchIcon width={18} height={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scroller}>
<<<<<<< HEAD
        {tab === 'following' ? <Following /> : isFriends ? <Friends /> : <ForYou filter={activeTab.filter} />}
=======
        {tab === 'following' ? <Following /> : <ForYou filter={activeTab.filter} refreshKey={refreshToken} />}
>>>>>>> 3c67263c8a15b3775da6bdd15e6fbc58fd100a88
      </div>
    </div>
  )
}
