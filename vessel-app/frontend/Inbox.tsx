import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './Inbox.module.css'
import { AuthOverlay, type AuthMode } from './Settings'
import {
  contentService,
  type MessageThread,
  type ThreadMessage,
  type SuggestedConnection,
  type NotificationSummary,
  type ApiUser,
} from '../services/contentService'
import { formatDateTime, formatRelativeTime } from '../utils/time'

type TabKey = 'notifications' | 'messages' | 'suggested'

type SuggestedCard = SuggestedConnection & {
  isFollowing: boolean
}

const quickReplyOptions = ['Thanks so much!', "Let's schedule something.", 'Appreciate you sharing this.', 'Praying with you!']

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeProfile, setActiveProfile] = React.useState(() => contentService.getActiveProfile())
  const selfHandle = normalizeHandle(activeProfile.id || '')
  const [tab, setTab] = React.useState<TabKey>('notifications')
  const [threads, setThreads] = React.useState<MessageThread[]>([])
  const [threadsLoading, setThreadsLoading] = React.useState(true)
  const [threadsError, setThreadsError] = React.useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [expandedThreadId, setExpandedThreadId] = React.useState<string | null>(null)
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
  const [notifications, setNotifications] = React.useState<NotificationSummary[]>([])
  const [notificationsLoading, setNotificationsLoading] = React.useState(false)
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null)
  const [composeVisible, setComposeVisible] = React.useState(false)
  const [composeHandleRaw, setComposeHandleRaw] = React.useState('')
  const [composeDraft, setComposeDraft] = React.useState('')
  const [composeBusy, setComposeBusy] = React.useState(false)
  const [composeError, setComposeError] = React.useState<string | null>(null)
  const [mutualFriends, setMutualFriends] = React.useState<ApiUser[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<{
    id: string
    sender: ApiUser | null
    body: string
    createdAt: string
  }[]>([])
  const [incomingRequestsLoading, setIncomingRequestsLoading] = React.useState(false)
  const [incomingRequestsError, setIncomingRequestsError] = React.useState<string | null>(null)
  const isAuthenticated = contentService.isAuthenticated()
  const threadRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

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

  const openComposer = React.useCallback(
    (handle?: string) => {
      setTab('messages')
      setComposeVisible(true)
      if (handle) {
        setComposeHandleRaw(handle.replace(/^@/, ''))
      } else {
        setComposeHandleRaw((current) => (current.trim() ? current : ''))
      }
    },
    []
  )

  React.useEffect(() => {
    const composeHandleParam = searchParams.get('compose')
    if (composeHandleParam) {
      openComposer(composeHandleParam)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('compose')
      setSearchParams(nextParams, { replace: true })
    }
  }, [openComposer, searchParams, setSearchParams])

  React.useEffect(() => {
    let cancelled = false
    async function loadMutuals() {
      if (!composeVisible || !isAuthenticated) {
        return
      }
      try {
        const [following, followers] = await Promise.all([
          contentService.fetchFollowingProfiles(),
          contentService.fetchFollowerProfiles(),
        ])
        if (cancelled) return
        const mutuals = buildMutuals(following, followers)
        setMutualFriends(mutuals)
      } catch {
        if (cancelled) return
        setMutualFriends([])
      }
    }
    void loadMutuals()
    return () => {
      cancelled = true
    }
  }, [composeVisible, isAuthenticated])

  React.useEffect(() => {
    let cancelled = false
    if (!isAuthenticated) {
      setNotifications([])
      setNotificationsLoading(false)
      setNotificationsError('Sign in to view your latest activity.')
      return () => {
        cancelled = true
      }
    }
    setNotificationsLoading(true)
    setNotificationsError(null)
    contentService
      .fetchNotifications()
      .then((items) => {
        if (!cancelled) {
          setNotifications(items)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load notifications.'
          setNotificationsError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNotificationsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, activeProfile.id])

  React.useEffect(() => {
    let cancelled = false
    async function loadRequests() {
      if (!isAuthenticated || tab !== 'messages') {
        setIncomingRequests([])
        return
      }
      setIncomingRequestsLoading(true)
      setIncomingRequestsError(null)
      try {
        const requests = await contentService.fetchIncomingMessageRequests()
        if (!cancelled) setIncomingRequests(requests)
      } catch (err) {
        if (!cancelled) setIncomingRequestsError(err instanceof Error ? err.message : 'Unable to load requests')
      } finally {
        if (!cancelled) setIncomingRequestsLoading(false)
      }
    }
    void loadRequests()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, tab, threadsRefreshKey])

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

  React.useEffect(() => {
    if (!activeConversationId && threads.length) {
      const firstId = threads[0].id
      setActiveConversationId(firstId)
      setExpandedThreadId(firstId)
    }
  }, [threads, activeConversationId])

  React.useEffect(() => {
    if (tab === 'messages' && !activeConversationId && threads.length) {
      const firstId = threads[0].id
      setActiveConversationId(firstId)
      setExpandedThreadId(firstId)
    }
  }, [tab, threads, activeConversationId])

  const activeThread = activeConversationId ? threads.find((thread) => thread.id === activeConversationId) ?? null : null

  React.useEffect(() => {
    if (!expandedThreadId || !activeConversationId) return
    const target = threadRefs.current[expandedThreadId]
    if (!target) return
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
    })
  }, [expandedThreadId, activeConversationId])

  React.useEffect(() => {
    const shouldLock = expandedThreadId && tab === 'messages'
    if (!shouldLock) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [expandedThreadId, tab])

  function handleSelectThread(id: string) {
    setExpandedThreadId((current) => (current === id ? null : id))
    setActiveConversationId(id)
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, unreadCount: 0 } : thread)))
  }

  const handleOpenThreadProfile = React.useCallback(
    (event: React.MouseEvent, handle: string | null) => {
      if (!handle) return
      event.stopPropagation()
      navigate(`/profile/${handle}`)
    },
    [navigate]
  )

  const dismissNotification = React.useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])

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
      // If server returned 202 with requests, show a user-friendly note that requests were created
      if ((error as any)?.status === 202) {
        setComposeError((error as any).message || 'Message requests were created for some recipients.')
        setComposeVisible(false)
        return
      }
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

  async function startNewConversation(event: React.FormEvent) {
    event.preventDefault()
    const target = composeHandleRaw.trim().replace(/^@/, '').toLowerCase()
    const body = composeDraft.trim()
    if (!target || !body) {
      setComposeError('Enter a handle and your message before sending.')
      return
    }
    setComposeBusy(true)
    setComposeError(null)
    try {
      const existing = findThreadByHandle(threads, target, selfHandle)
      if (existing) {
        setActiveConversationId(existing.id)
        setExpandedThreadId(existing.id)
        await sendMessage(existing.id, body)
        setComposeDraft('')
        setComposeHandleRaw('')
        setComposeVisible(false)
        return
      }
      const thread = await contentService.startConversation(target, body)
      setThreads((current) => {
        const filtered = current.filter((item) => item.id !== thread.id)
        return [thread, ...filtered].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      })
      setActiveConversationId(thread.id)
      setExpandedThreadId(thread.id)
      setComposeDraft('')
      setComposeHandleRaw('')
      setComposeVisible(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not start that conversation. Please try again.'
      setComposeError(message)
    } finally {
      setComposeBusy(false)
    }
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
    if (!isAuthenticated) {
      tabContent = (
        <div className={styles.status}>
          <p>Sign in to receive new follower, like, and comment alerts here.</p>
          <button type="button" className={styles.statusAction} onClick={() => setAuthMode('login')}>
            Sign in
          </button>
        </div>
      )
    } else if (notificationsLoading) {
      tabContent = <div className={styles.status}>Checking for new activity...</div>
    } else if (notificationsError) {
      tabContent = (
        <div className={styles.status}>
          <p>{notificationsError}</p>
          <button
            type="button"
            className={styles.statusAction}
            onClick={() => {
              setNotificationsLoading(true)
              setNotificationsError(null)
              contentService
                .fetchNotifications()
                .then((items) => setNotifications(items))
                .catch((error) => {
                  const message = error instanceof Error ? error.message : 'Unable to refresh notifications.'
                  setNotificationsError(message)
                })
                .finally(() => setNotificationsLoading(false))
            }}
          >
            Try again
          </button>
        </div>
      )
    } else if (!notifications.length) {
      tabContent = (
        <div className={styles.status}>
          You're all caught up. When someone follows, likes, or comments on your videos, it will appear here.
        </div>
      )
    } else {
      tabContent = notifications.map((item) => {
        const actorHandle = formatHandle(item.actor.handle || item.actor.name)
        const actorTarget = resolveNotificationActorTarget(item.actor)
        const copy = formatNotificationCopy(item)
        return (
          <article key={item.id} className={styles.notificationCard}>
            <div className={styles.notificationIcon}>{badgeIcon(item.type)}</div>
            <div className={styles.notificationCopy}>
              <span className={styles.notificationMessage}>
                <button
                  type="button"
                  className={styles.notificationHandle}
                  onClick={() => navigate(`/profile/${actorTarget}`)}
                >
                  {actorHandle}
                </button>{' '}
                {copy}
              </span>
              {item.commentPreview ? (
                <span className={styles.notificationPreview}>{item.commentPreview}</span>
              ) : null}
              <span className={styles.notificationTime}>{formatRelativeTime(item.createdAt)}</span>
            </div>
            <button
              type="button"
              className={styles.notificationDismiss}
              aria-label="Dismiss notification"
              onClick={() => dismissNotification(item.id)}
            >
              ×
            </button>
          </article>
        )
      })
    }
  } else if (tab === 'messages') {
    const composeSection = !isAuthenticated ? null : (
      <div className={styles.composeLauncher}>
        {composeVisible ? (
          <form className={styles.composeForm} onSubmit={startNewConversation}>
            <div className={styles.composeRow}>
              <label>
                To
                <div className={styles.handleInputWrap}>
                  <span className={styles.handlePrefix}>@</span>
                  <input
                    value={composeHandleRaw}
                    onChange={(event) => setComposeHandleRaw(event.target.value)}
                    placeholder="friend"
                    disabled={composeBusy}
                    aria-label="Recipient handle"
                  />
                </div>
              </label>
              <button
                type="button"
                className={styles.dismissButton}
                onClick={() => {
                  setComposeVisible(false)
                  setComposeDraft('')
                  setComposeHandleRaw('')
                  setComposeError(null)
                }}
                aria-label="Minimize composer"
              >
                ×
              </button>
            </div>
            {composeHandleRaw.length >= 0 && mutualFriends.length ? (
              <ul className={styles.handleSuggestions}>
                {filterSuggestions(mutualFriends, composeHandleRaw).map((friend) => (
                  <li key={friend.id}>
                    <button
                      type="button"
                      onClick={() => setComposeHandleRaw(normalizeHandle(friend.handle || friend.id))}
                    >
                      <span className={styles.handleSuggestionName}>@{normalizeHandle(friend.handle || friend.id)}</span>
                      <small className={styles.handleSuggestionMeta}>{friend.name}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              value={composeDraft}
              onChange={(event) => setComposeDraft(event.target.value)}
              placeholder="Type your message..."
              rows={3}
              disabled={composeBusy}
            />
            {composeError ? <p className={styles.composeError}>{composeError}</p> : null}
            <div className={styles.composeActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => {
                setComposeVisible(false)
                setComposeDraft('')
                setComposeHandleRaw('')
                setComposeError(null)
              }} disabled={composeBusy}>
                Cancel
              </button>
              <button type="submit" disabled={composeBusy || !composeDraft.trim() || !composeHandleRaw.trim()}>
                {composeBusy ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className={styles.composeButton} onClick={() => openComposer()}>
            New message
          </button>
        )}
      </div>
    )

    if (threadsLoading) {
      tabContent = (
        <>
          {composeSection}
          {incomingRequestsLoading ? (
            <div className={styles.status}>Checking your incoming message requests...</div>
          ) : incomingRequestsError ? (
            <div className={styles.status}>{incomingRequestsError}</div>
          ) : incomingRequests.length ? (
            <div className={styles.requestsPanel}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Message requests</strong>
              {incomingRequests.map((r) => (
                <div key={r.id} className={styles.requestRow}>
                  <div className={styles.requestBody}>
                    <div style={{ fontWeight: 700 }}>{r.sender ? formatHandle(r.sender.handle || r.sender.id) : '@unknown'}</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{r.body}</div>
                  </div>
                  <div className={styles.requestActions}>
                    <button
                      type="button"
                      className={styles.followButton}
                      onClick={async () => {
                        try {
                          const thread = await contentService.acceptMessageRequest(r.id)
                          setThreads((current) => [thread, ...current].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
                          setIncomingRequests((current) => current.filter((item) => item.id !== r.id))
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Unable to accept request')
                        }
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={styles.dismissButton}
                      onClick={async () => {
                        try {
                          await contentService.declineMessageRequest(r.id)
                          setIncomingRequests((current) => current.filter((item) => item.id !== r.id))
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Unable to decline request')
                        }
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.status}>Loading conversations...</div>
        </>
      )
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
        <>
          {composeSection}
          <div className={styles.status}>
            No messages yet. Visit Suggested to follow people you know and start the first conversation.
          </div>
        </>
      )
    } else {
      tabContent = (
        <>
          {composeSection}
          {threads.map((thread) => {
            const isActive = thread.id === activeConversationId
            const draftValue = drafts[thread.id] ?? ''
            const title = pickThreadTitle(thread, selfHandle)
            const preview = thread.lastMessage?.body ?? 'Start the conversation.'
            const lastTimestamp = thread.lastMessage?.createdAt ?? thread.updatedAt
            const timeAgo = formatRelativeTime(lastTimestamp, true)
            const badgeLetter = (title.replace(/^@/, '') || 'c')[0]?.toUpperCase() ?? 'C'
            const isSending = sendingThreadId === thread.id
            const targetHandle = resolveThreadTargetHandle(thread, selfHandle)
            const isExpanded = Boolean(isActive && activeThread && expandedThreadId === thread.id)
            return (
              <article
                key={thread.id}
                ref={(node) => {
                  threadRefs.current[thread.id] = node
                }}
                className={`${styles.threadCard} ${isExpanded ? styles.threadCardExpanded : ''}`}
              >
                <button
                  type="button"
                  className={`${styles.threadSummary} ${isExpanded ? styles.threadSummaryActive : ''}`}
                  onClick={() => handleSelectThread(thread.id)}
                  aria-expanded={isExpanded}
                >
                  <div className={`${styles.threadAvatar} ${thread.unreadCount > 0 ? styles.unread : ''}`}>
                    {badgeLetter}
                  </div>
                  <div className={styles.threadCopy}>
                    <div className={styles.threadTitleRow}>
                      <span
                        className={`${styles.threadActor} ${targetHandle ? styles.threadActorLink : ''}`}
                        title={targetHandle ? `View ${formatHandle(targetHandle)}'s profile` : undefined}
                        onClick={(event) => handleOpenThreadProfile(event, targetHandle)}
                      >
                        {title}
                      </span>
                      <span className={styles.threadTime}>{timeAgo}</span>
                    </div>
                    <p className={styles.threadPreview}>{preview}</p>
                  </div>
                </button>

                <div
                  className={`${styles.conversation} ${isExpanded ? styles.conversationOpen : styles.conversationClosed}`}
                  aria-hidden={!isExpanded}
                >
                  {isExpanded ? (
                    <>
                      {targetHandle ? (
                        <div className={styles.conversationHandleRow}>
                          <span className={styles.conversationHandleLabel}>Chatting with</span>
                          <button
                            type="button"
                            className={styles.conversationHandle}
                            onClick={(event) => handleOpenThreadProfile(event, targetHandle)}
                          >
                            {formatHandle(targetHandle)}
                          </button>
                          <div className={styles.conversationOptions}>
                            <button
                              type="button"
                              aria-label="Conversation options"
                              className={styles.conversationOptionButton}
                              onClick={async (e) => {
                                e.stopPropagation()
                                // confirm deletion
                                if (!window.confirm('Delete this conversation? This will remove it for you.')) return
                                try {
                                  await contentService.deleteThread(thread.id)
                                  // remove from local list and close panel if necessary
                                  setThreads((current) => current.filter((t) => t.id !== thread.id))
                                  if (activeConversationId === thread.id) {
                                    setActiveConversationId((current) => {
                                      const remaining = threads.filter((t) => t.id !== thread.id)
                                      return remaining.length ? remaining[0].id : null
                                    })
                                  }
                                  if (expandedThreadId === thread.id) {
                                    setExpandedThreadId(null)
                                  }
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : 'Unable to delete conversation.'
                                  window.alert(msg)
                                }
                              }}
                            >
                              ⋯
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {messageError ? <div className={styles.contactError}>{messageError}</div> : null}
                      <div className={styles.messageList}>
                        {messagesBusy && !messages.length ? (
                          <div className={styles.status}>Loading conversation...</div>
                        ) : null}
                        {messages.map((message) => {
                          const fromMe = isMessageFromCurrentUser(message, selfHandle)
                          const absoluteTime = formatDateTime(message.createdAt)
                          const relativeTime = formatRelativeTime(message.createdAt, true)
                          return (
                            <div
                              key={message.id}
                              className={`${styles.bubble} ${fromMe ? styles.bubbleMe : styles.bubbleThem}`}
                            >
                              <span>{message.body}</span>
                              <span className={styles.bubbleMeta}>
                                {absoluteTime} • {relativeTime}
                              </span>
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
                        <div className={styles.composeActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => updateDraft(thread.id, '')}
                            disabled={isSending}
                          >
                            Cancel
                          </button>
                          <button type="submit" disabled={!draftValue.trim() || isSending}>
                            {isSending ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      </form>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </>
      )
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

function badgeIcon(type: NotificationSummary['type']) {
  switch (type) {
    case 'like':
      return '❤️'
    case 'comment':
      return '💬'
    case 'follow':
    default:
      return '➕'
  }
}

function formatNotificationCopy(item: NotificationSummary): string {
  switch (item.type) {
    case 'follow':
      return 'started following you.'
    case 'like': {
      const label = item.videoTitle ? `"${item.videoTitle}"` : 'your video'
      return `liked ${label}.`
    }
    case 'comment': {
      const label = item.videoTitle ? `"${item.videoTitle}"` : 'your video'
      return `commented on ${label}.`
    }
    default:
      return 'sent you an update.'
  }
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function formatHandle(value: string): string {
  if (!value) return '@friend'
  return value.startsWith('@') ? value : `@${value}`
}

function findThreadPartner(
  thread: MessageThread,
  selfHandle: string
): MessageThread['participants'][number] | null {
  return (
    thread.participants.find((member) => normalizeHandle(member.handle || member.name) !== selfHandle) ??
    thread.participants[0] ??
    null
  )
}

function resolveThreadTargetHandle(thread: MessageThread, selfHandle: string): string | null {
  const participant = findThreadPartner(thread, selfHandle)
  if (!participant) return null
  const handle = (participant.handle || participant.name || '').trim()
  return handle ? normalizeHandle(handle) : null
}

function pickThreadTitle(thread: MessageThread, selfHandle: string): string {
  const participant = findThreadPartner(thread, selfHandle)
  if (!participant) {
    return 'Conversation'
  }
  const handle = participant.handle ? formatHandle(participant.handle) : ''
  return handle || participant.name || 'Conversation'
}

function isMessageFromCurrentUser(message: ThreadMessage, selfHandle: string): boolean {
  return normalizeHandle(message.sender.handle || message.sender.name) === selfHandle
}

function resolveNotificationActorTarget(actor: NotificationSummary['actor']): string {
  const handle = (actor.handle || '').trim()
  if (handle) {
    return handle.replace(/^@/, '')
  }
  const identifier = (actor.id || '').trim()
  if (identifier) {
    return identifier
  }
  const fallback = (actor.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return fallback || 'creator'
}

function buildMutuals(following: ApiUser[], followers: ApiUser[]): ApiUser[] {
  const followerHandles = new Set(followers.map((user) => normalizeHandle(user.handle || user.id)))
  const followerIds = new Set(followers.map((user) => normalizeHandle(user.id)))
  return following.filter((user) => {
    const handle = normalizeHandle(user.handle || user.id)
    const id = normalizeHandle(user.id)
    return (handle && followerHandles.has(handle)) || (id && followerIds.has(id))
  })
}

function filterSuggestions(mutuals: ApiUser[], currentHandle: string): ApiUser[] {
  const query = normalizeHandle(currentHandle)
  if (!query) return mutuals.slice(0, 8)
  return mutuals.filter((user) => normalizeHandle(user.handle || user.id).includes(query)).slice(0, 8)
}

function findThreadByHandle(threads: MessageThread[], targetHandle: string, selfHandle: string): MessageThread | null {
  const normalizedTarget = normalizeHandle(targetHandle)
  if (!normalizedTarget) return null
  return (
    threads.find((thread) =>
      thread.participants.some(
        (participant) =>
          normalizeHandle(participant.handle || participant.name) === normalizedTarget &&
          normalizeHandle(participant.handle || participant.name) !== selfHandle
      )
    ) ?? null
  )
}
