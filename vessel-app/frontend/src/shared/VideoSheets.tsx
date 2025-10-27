import React from "react"
import { contentService, type Video } from "../services/contentService"
import { payfastClient } from "../services/payfastClient"
import { stripeClient } from "../services/stripeClient"
import styles from "./VideoSheets.module.css"

type CommentEntry = {
  id: string
  author: string
  message: string
  timestamp: string
}

const COMMENT_POOL: CommentEntry[] = [
  { id: "c1", author: "Sophia", message: "So encouraging, thank you for sharing!", timestamp: "2h" },
  { id: "c2", author: "Mason", message: "Playing this on repeat this week.", timestamp: "6h" },
  { id: "c3", author: "Noah", message: "Needed this reminder today.", timestamp: "1d" },
  { id: "c4", author: "Lena", message: "This hit home for our youth group.", timestamp: "3d" },
  { id: "c5", author: "Eden", message: "We shared this in Sunday service!", timestamp: "5d" },
]

function buildComments(clip: Video): CommentEntry[] {
  const total = Math.max(4, Math.min(12, (clip.comments ?? 0) % 10 + 4))
  const generated: CommentEntry[] = []
  for (let i = 0; i < total; i += 1) {
    const poolEntry = COMMENT_POOL[i % COMMENT_POOL.length]
    generated.push({
      id: `${clip.id}-comment-${i}`,
      author: poolEntry.author,
      message: poolEntry.message,
      timestamp: poolEntry.timestamp,
    })
  }
  return generated
}

type CommentSheetProps = {
  clip: Video
  onClose: () => void
}

export function CommentSheet({ clip, onClose }: CommentSheetProps) {
  const [entries, setEntries] = React.useState<CommentEntry[]>(() => buildComments(clip))
  const [input, setInput] = React.useState("")

  const submit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const trimmed = input.trim()
      if (!trimmed) return
      contentService.recordComment(clip.id)
      const newEntry: CommentEntry = {
        id: `${clip.id}-user-${Date.now()}`,
        author: "You",
        message: trimmed,
        timestamp: "Just now",
      }
      setEntries((prev) => [newEntry, ...prev])
      setInput("")
    },
    [clip.id, input]
  )

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <div className={styles.sheetPanel}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>{`${entries.length} comments`}</h3>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close comments">
            x
          </button>
        </div>
        <div className={styles.sheetBody}>
          {entries.map((entry) => (
            <div key={entry.id} className={styles.commentItem}>
              <div className={styles.commentAvatar}>{entry.author.slice(0, 1).toUpperCase()}</div>
              <div className={styles.commentContent}>
                <div className={styles.commentHeader}>
                  <span>{entry.author}</span>
                  <span className={styles.commentMeta}>{entry.timestamp}</span>
                </div>
                <p className={styles.commentText}>{entry.message}</p>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.sheetFooter}>
          <form className={styles.sheetInput} onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Add a comment"
              aria-label="Add a comment"
            />
            <button type="submit" className={styles.donateConfirm} disabled={!input.trim()}>
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

type DonateSheetProps = {
  clip: Video
  onClose: () => void
}

export function DonateSheet({ clip, onClose }: DonateSheetProps) {
  const [amount, setAmount] = React.useState<number>(25)
  const [busy, setBusy] = React.useState(false)
  const stripeAvailable = stripeClient.isConfigured()
  const [gateway, setGateway] = React.useState<"payfast" | "stripe">(stripeAvailable ? "stripe" : "payfast")

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(event.target.value))
  }, [])

  const confirm = React.useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      contentService.recordDonation(clip.id, amount)
      if (gateway === "stripe") {
        await stripeClient.startDonation({
          amount,
          description: clip.title,
          reference: `${clip.id}-${Date.now()}`,
        })
      } else {
        payfastClient.startDonation({
          amount,
          itemName: `Support ${clip.user.name}`,
          itemDescription: clip.title,
          reference: `${clip.id}-${Date.now()}`,
        })
      }
      onClose()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to launch the selected payment gateway. Please try again."
      window.alert(message)
    } finally {
      setBusy(false)
    }
  }, [amount, busy, clip.id, clip.title, clip.user.name, gateway, onClose])

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <div className={styles.sheetPanel}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>Support this creator</h3>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close donation">
            x
          </button>
        </div>
        <div className={styles.sheetBody}>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            Choose an amount to give and we'll deliver your encouragement to {clip.user.name}.
          </p>
          <div className={styles.gatewayGroup}>
            <span className={styles.gatewayLabel}>Payment method</span>
            <div className={styles.gatewayOptions}>
              <label
                className={`${styles.gatewayOption} ${gateway === "payfast" ? styles.gatewayOptionActive : ""}`}
              >
                <input
                  type="radio"
                  name="donation-gateway"
                  value="payfast"
                  checked={gateway === "payfast"}
                  onChange={() => setGateway("payfast")}
                  disabled={busy}
                />
                <span className={styles.gatewayTitle}>PayFast</span>
                <span className={styles.gatewayHint}>Cards, EFT, and wallet (SA)</span>
              </label>
              <label
                className={`${styles.gatewayOption} ${
                  gateway === "stripe" ? styles.gatewayOptionActive : ""
                } ${stripeAvailable ? "" : styles.gatewayOptionDisabled}`}
              >
                <input
                  type="radio"
                  name="donation-gateway"
                  value="stripe"
                  checked={gateway === "stripe"}
                  onChange={() => setGateway("stripe")}
                  disabled={!stripeAvailable || busy}
                />
                <span className={styles.gatewayTitle}>Stripe</span>
                <span className={styles.gatewayHint}>
                  {stripeAvailable ? "Visa, Mastercard, Apple Pay" : "Add Stripe keys to enable"}
                </span>
              </label>
            </div>
          </div>
          <div className={styles.donateSlider}>
            <label htmlFor="donation-range">Gift amount</label>
            <div className={styles.donateAmount}>${amount}</div>
            <input
              id="donation-range"
              type="range"
              min={1}
              max={100}
              step={1}
              value={amount}
              onChange={handleChange}
              disabled={busy}
            />
            <div className={styles.donateScale}>
              <span>$1</span>
              <span>$100</span>
            </div>
          </div>
        </div>
        <div className={styles.donateActionBar}>
          <button type="button" className={styles.donateCancel} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={styles.donateConfirm} onClick={confirm} disabled={busy}>
            {busy ? "Processing..." : "Confirm gift"}
          </button>
        </div>
      </div>
    </div>
  )
}
