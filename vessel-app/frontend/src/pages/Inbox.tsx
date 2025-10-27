import React from 'react'
import styles from './Inbox.module.css'

type NotificationItem = {
  id: string
  type: 'follow' | 'like' | 'comment' | 'donation'
  actor: string
  message: string
  timeAgo: string
}

type ConversationMessage = {
  id: string
  sender: 'me' | 'them'
  text: string
  timeAgo: string
}

type ConversationThread = {
  id: string
  author: string
  preview: string
  timeAgo: string
  unread?: boolean
  messages: ConversationMessage[]
}

type TabKey = 'notifications' | 'messages'

const notifications: NotificationItem[] = [
  { id: 'n1', type: 'like', actor: '@risinghope', message: 'loved Sunrise Worship Session', timeAgo: '2m' },
  { id: 'n2', type: 'comment', actor: '@prayercircle', message: 'left a prayer on Psalm 23 reflection', timeAgo: '15m' },
  { id: 'n3', type: 'donation', actor: '@melodyfaith', message: 'sent a $5 donation', timeAgo: '1h' },
  { id: 'n4', type: 'follow', actor: '@revivalkids', message: 'started following you', timeAgo: '2h' },
]

const messageThreadsSeed: ConversationThread[] = [
  {
    id: 'm1',
    author: '@graceinmotion',
    preview: 'Would love to collab on a live worship night!',
    timeAgo: '5m',
    unread: true,
    messages: [
      {
        id: 'm1-msg-1',
        sender: 'them',
        text: 'Hey! Would love to collab on a live worship night. Are you free next Thursday?',
        timeAgo: '5m',
      },
      {
        id: 'm1-msg-2',
        sender: 'me',
        text: 'That sounds amazing. I will check our schedule.',
        timeAgo: '4m',
      },
    ],
  },
  {
    id: 'm2',
    author: '@citychurch',
    preview: 'Thank you for sharing the Romans 8 breakdown.',
    timeAgo: '47m',
    messages: [
      {
        id: 'm2-msg-1',
        sender: 'them',
        text: 'Thank you for sharing the Romans 8 breakdown. Our small group loved it.',
        timeAgo: '47m',
      },
    ],
  },
  {
    id: 'm3',
    author: '@heartsong',
    preview: 'Praying for your family! Isaiah 26 has been on my heart.',
    timeAgo: '3h',
    messages: [
      {
        id: 'm3-msg-1',
        sender: 'them',
        text: 'Praying for your family! Isaiah 26 has been on my heart for you all today.',
        timeAgo: '3h',
      },
      {
        id: 'm3-msg-2',
        sender: 'me',
        text: 'Thank you so much. That passage is always a comfort.',
        timeAgo: '3h',
      },
    ],
  },
]

const quickReplyOptions = [
  'Thanks so much!',
  'Let’s schedule something.',
  'Appreciate you sharing this.',
  'Praying with you!',
]

export default function Inbox() {
  const [tab, setTab] = React.useState<TabKey>('notifications')
  const [threads, setThreads] = React.useState<ConversationThread[]>(() => messageThreadsSeed)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(
    () => messageThreadsSeed[0]?.id ?? null
  )
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (tab === 'messages' && !activeConversationId && threads.length) {
      setActiveConversationId(threads[0].id)
    }
  }, [tab, activeConversationId, threads])

  const activeConversation = activeConversationId
    ? threads.find((thread) => thread.id === activeConversationId) ?? null
    : null

  function handleSelectThread(id: string) {
    setActiveConversationId(id)
    setThreads((current) =>
      current.map((thread) => (thread.id === id ? { ...thread, unread: false } : thread))
    )
  }

  function updateDraft(id: string, value: string) {
    setDrafts((current) => ({ ...current, [id]: value }))
  }

  function sendMessage(conversationId: string, overrideText?: string) {
    const text = (overrideText ?? drafts[conversationId] ?? '').trim()
    if (!text) return

    const timestamp = Date.now()
    const outgoing: ConversationMessage = {
      id: `out-${conversationId}-${timestamp}`,
      sender: 'me',
      text,
      timeAgo: 'Just now',
    }

    setThreads((current) =>
      current.map((thread) =>
        thread.id === conversationId
          ? {
              ...thread,
              unread: false,
              preview: outgoing.text,
              timeAgo: outgoing.timeAgo,
              messages: [...thread.messages, outgoing],
            }
          : thread
      )
    )

    setDrafts((current) => ({ ...current, [conversationId]: '' }))

    window.setTimeout(() => {
      setThreads((current) =>
        current.map((thread) => {
          if (thread.id !== conversationId) return thread
          const reply: ConversationMessage = {
            id: `in-${conversationId}-${Date.now()}`,
            sender: 'them',
            text: 'Appreciate your message! I will respond in detail soon.',
            timeAgo: 'Just now',
          }
          return {
            ...thread,
            preview: reply.text,
            timeAgo: reply.timeAgo,
            messages: [...thread.messages, reply],
          }
        })
      )
    }, 1400)
  }

  const tabContent =
    tab === 'notifications'
      ? notifications.map((item) => (
          <article key={item.id} className={styles.item}>
            <div className={`${styles.badge} ${styles[item.type]}`}>{badgeIcon(item.type)}</div>
            <div className={styles.body}>
              <div className={styles.title}>
                <span className={styles.actor}>{item.actor}</span> {item.message}
              </div>
              <span className={styles.time}>{item.timeAgo} ago</span>
            </div>
          </article>
        ))
      : threads.map((thread) => {
          const isActive = thread.id === activeConversationId
          const draftValue = drafts[thread.id] ?? ''
          return (
            <article key={thread.id} className={`${styles.item} ${styles.thread}`}>
              <button
                type="button"
                className={`${styles.threadHeader} ${isActive ? styles.threadHeaderActive : ''}`}
                onClick={() => handleSelectThread(thread.id)}
              >
                <div className={`${styles.badge} ${thread.unread ? styles.unread : styles.message}`}>
                  {thread.author.slice(1, 2).toUpperCase()}
                </div>
                <div className={styles.body}>
                  <div className={styles.title}>
                    <span className={styles.actor}>{thread.author}</span>
                  </div>
                  <p className={styles.preview}>{thread.preview}</p>
                  <span className={styles.time}>{thread.timeAgo} ago</span>
                </div>
              </button>

              {isActive && activeConversation ? (
                <div className={styles.conversation}>
                  <div className={styles.messageList}>
                    {activeConversation.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`${styles.bubble} ${
                          message.sender === 'me' ? styles.bubbleMe : styles.bubbleThem
                        }`}
                      >
                        <span>{message.text}</span>
                        <span className={styles.bubbleMeta}>{message.timeAgo}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.quickReplies}>
                    {quickReplyOptions.map((reply) => (
                      <button
                        key={`${thread.id}-${reply}`}
                        type="button"
                        className={styles.quickReply}
                        onClick={() => sendMessage(thread.id, reply)}
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
                    />
                    <button type="submit" disabled={!draftValue.trim()}>
                      Send
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          )
        })

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
        <button
          type="button"
          className={tab === 'messages' ? styles.tabActive : styles.tab}
          onClick={() => setTab('messages')}
        >
          Messages
        </button>
      </div>

      <section className={styles.panel}>{tabContent}</section>
    </div>
  )
}

function badgeIcon(type: NotificationItem['type']) {
  switch (type) {
    case 'like':
      return '❤'
    case 'comment':
      return '💬'
    case 'donation':
      return '$'
    case 'follow':
    default:
      return '+'
  }
}
