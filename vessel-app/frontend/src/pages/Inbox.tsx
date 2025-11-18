import React from 'react'
import styles from './Inbox.module.css'
import { AuthOverlay, type AuthMode } from './Settings'
import { contentService, type MessageThread, type ThreadMessage, type SuggestedConnection } from '../services/contentService'
import { formatRelativeTime } from '../utils/time'

type NotificationItem = {
  id: string
  type: 'follow' | 'like' | 'comment' | 'donation'
  actor: string
  message: string
  timeAgo: string
}

type TabKey = 'notifications' | 'messages' | 'suggested'

type SuggestedCard = SuggestedConnection & {
  isFollowing: boolean
}

const notifications: NotificationItem[] = [
  { id: 'n1', type: 'like', actor: '@risinghope', message: 'loved Sunrise Worship Session', timeAgo: '2m' },
  { id: 'n2', type: 'comment', actor: '@prayercircle', message: 'left a prayer on Psalm 23 reflection', timeAgo: '15m' },
  { id: 'n3', type: 'donation', actor: '@melodyfaith', message: 'sent a $5 donation', timeAgo: '1h' },
  { id: 'n4', type: 'follow', actor: '@revivalkids', message: 'started following you', timeAgo: '2h' },
]

const quickReplyOptions = ['Thanks so much!', "Let's schedule something.", 'Appreciate you sharing this.', 'Praying with you!']

export default function Inbox() {
  const [activeProfile, setActiveProfile] = React.useState(() => contentService.getActiveProfile())
  const selfHandle = normalizeHandle(activeProfile.id || '')
  const [tab, setTab] = React.useState<TabKey>('notifications')
  const [threads, setThreads] = React.useState<MessageThread[]>([])
  const [threadsLoading, setThreadsLoading] = React.useState(true)
  const [threadsError, setThreadsError] = React.useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ThreadMessage[]>([])
  const [messagesBusy, setMessagesBusy] = React.useState(false)
  const [messageError, setMessageError] = React.useState<string | null>(null)
  const [sendingThreadId, setSendingThreadId] = React.useState<string | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [suggestions, setSuggestions] = React.useState<SuggestedCard[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(true)
  const [suggestionsError, setSuggestionsError] = React.useState<string | null>(null)
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null)
  const [authMode, setAuthMode] = React.useState<AuthMode | null>(null)
  const [threadsRefreshKey, setThreadsRefreshKey] = React.useState(0)

  React.useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setActiveProfile(contentService.getActiveProfile())
    })
    return unsubscribe
  }, [threadsRefreshKey])

  React.useEffect(() => {
    let cancelled = false
    async function loadThreads() {
      setThreadsLoading(true)
      setThreadsError(null)
      try {
        const data = await contentService.fetchMessageThreads()
        if (!cancelled) {
          setThreads(data)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load conversations.'
          setThreadsError(message)
        }
      } finally {
        if (!cancelled) {
          setThreadsLoading(false)
        }
      }
    }
    void loadThreads()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!activeConversationId && threads.length) {
      setActiveConversationId(threads[0].id)
    }
  }, [threads, activeConversationId])

  React.useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesBusy(true)
    setMessageError(null)
    contentService
      .fetchThreadMessages(activeConversationId)
      .then((data) => {
        if (!cancelled) {
          setMessages(data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load this conversation.'
          setMessageError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMessagesBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeConversationId])

  React.useEffect(() => {
    if (tab === 'messages' && !activeConversationId && threads.length) {
      setActiveConversationId(threads[0].id)
    }
  }, [tab, threads, activeConversationId])

  React.useEffect(() => {
    let cancelled = false
    async function loadSuggestions() {
      setSuggestionsLoading(true)
      setSuggestionsError(null)
      try {
        const data = await contentService.fetchConnectionSuggestions(4)
        if (!cancelled) {
          setSuggestions(
            data.map((item) => ({
              ...item,
              isFollowing: contentService.isFollowing(item.handle),
            }))
          )
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Unable to load suggested connections right now.'
          setSuggestionsError(message)
          setSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false)
        }
      }
    }
    void loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [threadsRefreshKey, activeProfile.id])

  const activeThread = activeConversationId ? threads.find((thread) => thread.id === activeConversationId) ?? null : null

  function handleSelectThread(id: string) {
    setActiveConversationId(id)
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, unreadCount: 0 } : thread)))
  }

  function updateDraft(threadId: string, value: string) {
    setDrafts((current) => ({ ...current, [threadId]: value }))
  }

  async function sendMessage(conversationId: string, overrideText?: string) {
    const text = (overrideText ?? drafts[conversationId] ?? '').trim()
    if (!text) return
    setSendingThreadId(conversationId)
    try {
      const message = await contentService.sendThreadMessage(conversationId, text)
      if (conversationId === activeConversationId) {
        setMessages((current) => [...current, message])
      }
      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === conversationId
              ? { ...thread, lastMessage: message, unreadCount: 0, updatedAt: message.createdAt }
              : thread
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
      setDrafts((current) => ({ ...current, [conversationId]: '' }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send that message right now.'
      window.alert(message)
    } finally {
      setSendingThreadId((current) => (current === conversationId ? null : current))
    }
  }

  async function followSuggestionCard(id: string) {
    const target = suggestions.find((item) => item.id === id)
    if (!target || target.isFollowing) {
      return
    }
    setFollowBusyId(id)
    try {
      await contentService.followUser(target.handle)
      setSuggestions((current) => current.map((item) => (item.id === id ? { ...item, isFollowing: true } : item)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to follow right now.'
      window.alert(message)
    } finally {
      setFollowBusyId((current) => (current === id ? null : current))
    }
  }

  function dismissSuggestion(id: string) {
    setSuggestions((current) => current.filter((item) => item.id !== id))
  }

  const handleAuthClose = React.useCallback(() => {
    setAuthMode(null)
  }, [])

  const handleAuthSwitch = React.useCallback((mode: AuthMode | null) => {
    setAuthMode(mode)
  }, [])

  const handleAuthComplete = React.useCallback(() => {
    setAuthMode(null)
    setThreadsRefreshKey((value) => value + 1)
  }, [])

  let tabContent: React.ReactNode

  if (tab === 'notifications') {
    tabContent = notifications.map((item) => (
      <article key={item.id} className={styles.notificationCard}>
        <div className={styles.notificationIcon}>
          {badgeIcon(item.type)}
        </div>
        <div className={styles.notificationCopy}>
          <span className={styles.notificationMessage}>
            <span className={styles.notificationHandle}>{item.actor}</span> {item.message}
          </span>
          <span className={styles.notificationTime}>{item.timeAgo} ago</span>
        </div>
      </article>
    ))
  } else if (tab === 'messages') {
    if (threadsLoading) {
      tabContent = <div className={styles.status}>Loading conversations...</div>
    } else if (threadsError) {
      const needsAuth = /sign in/i.test(threadsError)
      tabContent = (
        <div className={styles.status}>
          <p>{threadsError}</p>
          {needsAuth ? (
            <button type="button" className={styles.statusAction} onClick={() => setAuthMode('login')}>
              Please sign in to continue
            </button>
          ) : null}
        </div>
      )
    } else if (!threads.length) {
      tabContent = (
        <div className={styles.status}>
          No messages yet. Visit Suggested to follow people you know and start the first conversation.
        </div>
      )
    } else {
      tabContent = threads.map((thread) => {
        const isActive = thread.id === activeConversationId
        const draftValue = drafts[thread.id] ?? ''
        const title = pickThreadTitle(thread, selfHandle)
        const preview = thread.lastMessage?.body ?? 'Start the conversation.'
        const lastTimestamp = thread.lastMessage?.createdAt ?? thread.updatedAt
        const timeAgo = formatRelativeTime(lastTimestamp, true)
        const badgeLetter = (title.replace(/^@/, '') || 'c')[0]?.toUpperCase() ?? 'C'
        const isSending = sendingThreadId === thread.id
        return (
          <article key={thread.id} className={`${styles.item} ${styles.thread}`}>
            <button
              type="button"
              className={`${styles.threadHeader} ${isActive ? styles.threadHeaderActive : ''}`}
              onClick={() => handleSelectThread(thread.id)}
            >
              <div className={`${styles.badge} ${thread.unreadCount > 0 ? styles.unread : styles.message}`}>
                {badgeLetter}
              </div>
              <div className={styles.body}>
                <div className={styles.title}>
                  <span className={styles.actor}>{title}</span>
                </div>
                <p className={styles.preview}>{preview}</p>
                <span className={styles.time}>{timeAgo}</span>
              </div>
            </button>

            {isActive && activeThread ? (
              <div className={styles.conversation}>
                {messageError ? <div className={styles.contactError}>{messageError}</div> : null}
                <div className={styles.messageList}>
                  {messagesBusy && !messages.length ? (
                    <div className={styles.status}>Loading conversation...</div>
                  ) : null}
                  {messages.map((message) => {
                    const fromMe = isMessageFromCurrentUser(message, selfHandle)
                    return (
                      <div
                        key={message.id}
                        className={`${styles.bubble} ${fromMe ? styles.bubbleMe : styles.bubbleThem}`}
                      >
                        <span>{message.body}</span>
                        <span className={styles.bubbleMeta}>{formatRelativeTime(message.createdAt)}</span>
                      </div>
                    )
                  })}
                </div>

                <div className={styles.quickReplies}>
                  {quickReplyOptions.map((reply) => (
                    <button
                      key={`${thread.id}-${reply}`}
                      type="button"
                      className={styles.quickReply}
                      onClick={() => sendMessage(thread.id, reply)}
                      disabled={isSending}
                    >
                      {reply}
                    </button>
                  ))}
                </div>

                <form
                  className={styles.composer}
                  onSubmit={(event) => {
                    event.preventDefault()
                    sendMessage(thread.id)
                  }}
                >
                  <textarea
                    value={draftValue}
                    onChange={(event) => updateDraft(thread.id, event.target.value)}
                    placeholder="Type a message..."
                    rows={2}
                    disabled={isSending}
                  />
                  <button type="submit" disabled={!draftValue.trim() || isSending}>
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        )
      })
    }
  } else {
    tabContent = (
      <div className={styles.suggestedPanel}>
        {suggestionsLoading ? (
          <div className={styles.status}>Finding people you may know...</div>
        ) : suggestionsError ? (
          <div className={styles.status}>{suggestionsError}</div>
        ) : !suggestions.length ? (
          <div className={styles.status}>No suggestions yet. Follow a few creators to see familiar faces here.</div>
        ) : (
          suggestions.map((suggestion) => {
            const avatarLetter = formatHandle(suggestion.handle).slice(1, 2).toUpperCase()
            const mutualText =
              suggestion.mutualConnections > 1
                ? `${suggestion.mutualConnections} mutual connections`
                : '1 mutual connection'
            const followDisabled = suggestion.isFollowing || followBusyId === suggestion.id
            return (
              <article key={suggestion.id} className={styles.suggestionCard}>
                <div className={styles.suggestionAvatar}>
                  {suggestion.photoUrl ? (
                    <img src={suggestion.photoUrl} alt={suggestion.name} />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTopRow}>
                    <div className={styles.suggestionTextGroup}>
                      <span className={styles.suggestionLabel}>You may know</span>
                      <strong>{formatHandle(suggestion.handle)}</strong>
                    </div>
                    <div className={styles.suggestionActionsCompact}>
                      <button
                        type="button"
                        className={styles.followButton}
                        disabled={followDisabled}
                        onClick={() => followSuggestionCard(suggestion.id)}
                      >
                        {suggestion.isFollowing ? 'Following' : followDisabled ? 'Following...' : 'Follow'}
                      </button>
                      <button
                        type="button"
                        aria-label="Dismiss suggestion"
                        className={styles.dismissButton}
                        onClick={() => dismissSuggestion(suggestion.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {suggestion.summary ? <small className={styles.suggestionSummary}>{suggestion.summary}</small> : null}
                  <span className={styles.suggestionMeta}>{mutualText}</span>
                </div>
              </article>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className={styles.inbox}>
      <header className={styles.hero}>
        <h1>Inbox</h1>
        <p>Track your notifications, donations, and messages in one place.</p>
      </header>

      <div className={styles.tabBar}>
        <button
          type="button"
          className={tab === 'notifications' ? styles.tabActive : styles.tab}
          onClick={() => setTab('notifications')}
        >
          Notifications
        </button>
        <button type="button" className={tab === 'messages' ? styles.tabActive : styles.tab} onClick={() => setTab('messages')}>
          Messages
        </button>
        <button
          type="button"
          className={tab === 'suggested' ? styles.tabActive : styles.tab}
          onClick={() => setTab('suggested')}
        >
          Suggested
        </button>
      </div>

      <section className={styles.panel}>{tabContent}</section>
      {authMode ? (
        <AuthOverlay
          mode={authMode}
          activeProfile={activeProfile}
          onClose={handleAuthClose}
          onSwitchMode={handleAuthSwitch}
          onComplete={handleAuthComplete}
        />
      ) : null}
    </div>
  )
}

function badgeIcon(type: NotificationItem['type']) {
  switch (type) {
    case 'like':
      return '<3'
    case 'comment':
      return 'C'
    case 'donation':
      return '$'
    case 'follow':
    default:
      return '+'
  }
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function formatHandle(value: string): string {
  if (!value) return '@friend'
  return value.startsWith('@') ? value : `@${value}`
}

function pickThreadTitle(thread: MessageThread, selfHandle: string): string {
  const participant =
    thread.participants.find((member) => normalizeHandle(member.handle || member.name) !== selfHandle) ??
    thread.participants[0]
  if (!participant) {
    return 'Conversation'
  }
  const handle = participant.handle ? formatHandle(participant.handle) : ''
  return handle || participant.name || 'Conversation'
}

function isMessageFromCurrentUser(message: ThreadMessage, selfHandle: string): boolean {
  return normalizeHandle(message.sender.handle || message.sender.name) === selfHandle
}

