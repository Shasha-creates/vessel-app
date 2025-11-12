import React from 'react'
import { useNavigate } from 'react-router-dom'
import ForYou from './ForYou'
import Following from './Following'
import styles from './Feed.module.css'
import type { Video } from '../services/contentService'
import { Media } from '../media'
import { HeartIcon, HomeIcon, MessageIcon, PlusIcon, SearchIcon, UserIcon } from '../shared/icons'

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

const bottomNavItems: Array<{
  id: string
  label: string
  icon: React.ReactNode
  to: string
  badge?: string
  variant?: 'upload'
}> = [
  { id: 'home', label: 'Home', icon: <HomeIcon width={18} height={18} />, to: '/' },
  { id: 'friends', label: 'Friends', icon: <HeartIcon width={18} height={18} />, to: '/home' },
  { id: 'upload', label: 'Upload', icon: <PlusIcon width={18} height={18} />, to: '/upload', variant: 'upload' },
  { id: 'inbox', label: 'Inbox', icon: <MessageIcon width={18} height={18} />, to: '/inbox', badge: '9' },
  { id: 'profile', label: 'Profile', icon: <UserIcon width={18} height={18} />, to: '/profile/me' },
]

export default function Feed() {
  const [tab, setTab] = React.useState<TabKey>('forYou')
  const [activeNav, setActiveNav] = React.useState('home')
  const navigate = useNavigate()

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[3]

  return (
    <div className={styles.feed}>
      <div className={styles.topChrome}>
        <div className={styles.topBar}>
          <div className={styles.tabHeader}>
            <div className={styles.leftTray}>
              <img src={Media.icons.logo} alt="Godlyme" className={styles.brandGlyph} />
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
              <button type="button" aria-label="Search" onClick={() => navigate('/home')}>
                <SearchIcon width={18} height={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scroller}>
        {tab === 'following' ? <Following /> : <ForYou filter={activeTab.filter} />}
        <div className={styles.bottomChrome}>
          {bottomNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.bottomButton} ${activeNav === item.id ? styles.bottomButtonActive : ''} ${
                item.variant === 'upload' ? styles.bottomButtonUpload : ''
              }`}
              aria-label={item.label}
              onClick={() => {
                setActiveNav(item.id)
                navigate(item.to)
              }}
            >
              <span
                className={`${styles.bottomIcon} ${item.variant === 'upload' ? styles.bottomIconUpload : ''}`}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {item.variant === 'upload' ? null : <span className={styles.bottomLabel}>{item.label}</span>}
              {item.badge ? <span className={styles.bottomBadge}>{item.badge}</span> : null}
              {item.variant === 'upload' ? null : (
                <span
                  aria-hidden="true"
                  className={
                    activeNav === item.id ? styles.bottomIndicatorActive : styles.bottomIndicator
                  }
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
