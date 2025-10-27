import React from 'react'
import { useNavigate } from 'react-router-dom'
import ForYou from './ForYou'
import Following from './Following'
import styles from './Feed.module.css'
import type { Video } from '../services/contentService'

type TabKey = 'live' | 'music' | 'following' | 'forYou' | 'prayer'

const tabs: Array<{
  id: TabKey
  label: string
  filter?: (clip: Video) => boolean
}> = [
  { id: 'live', label: 'Live', filter: (clip) => clip.featured ?? false },
  { id: 'music', label: 'Music', filter: () => false },
  { id: 'following', label: 'Following' },
  { id: 'forYou', label: 'For You' },
  { id: 'prayer', label: 'Prayer', filter: () => false },
]

const bottomNavItems = [
  { id: 'discover', label: 'Discover', icon: 'D', to: '/' },
  { id: 'upload', label: 'Add', icon: '+', to: '/upload' },
  { id: 'inbox', label: 'Inbox', icon: 'I', to: '/inbox' },
  { id: 'profile', label: 'Profile', icon: 'P', to: '/profile/me' },
]

export default function Feed() {
  const [tab, setTab] = React.useState<TabKey>('forYou')
  const navigate = useNavigate()

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[3]

  const clock = React.useMemo(() => {
    const now = new Date()
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  return (
    <div className={styles.feed}>
      <div className={styles.topChrome}>
        <div className={styles.statusRow}>
          <span className={styles.clock}>{clock}</span>
          <div className={styles.statusIcons}>
            <button type="button" aria-label="Notifications" onClick={() => navigate('/inbox')}>
              🔔
            </button>
            <button type="button" aria-label="Search" onClick={() => navigate('/home')}>
              🔍
            </button>
          </div>
        </div>
        <div className={styles.tabRail}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? styles.tabButtonActive : styles.tabButton}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.bottomChrome}>
        {bottomNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.bottomButton}
            onClick={() => navigate(item.to)}
          >
            <span className={styles.bottomIcon}>{item.icon}</span>
            <span className={styles.bottomLabel}>{item.label}</span>
            {item.id === 'inbox' ? <span className={styles.bottomBadge}>9</span> : null}
          </button>
        ))}
      </div>

      <div className={styles.scroller}>
        {tab === 'following' ? <Following /> : <ForYou filter={activeTab.filter} />}
      </div>
    </div>
  )
}
