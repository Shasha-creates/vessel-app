import React from "react"
import { contentService, type Video, type VideoComment } from "../services/contentService"
import { payfastClient } from "../services/payfastClient"
import { stripeClient } from "../services/stripeClient"
import { formatRelativeTime } from "../utils/time"
import styles from "./VideoSheets.module.css"

type CommentSheetProps = {
  clip: Video
  onClose: () => void
}

export function CommentSheet({ clip, onClose }: CommentSheetProps) {
  const [entries, setEntries] = React.useState<VideoComment[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [posting, setPosting] = React.useState(false)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    contentService
      .fetchClipComments(clip.id)
      .then((list) => {
        if (active) {
          setEntries(list)
        }
      })
      .catch((err) => {
        if (!active) return
        const message = err instanceof Error ? err.message : "Unable to load comments right now."
        setError(message)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [clip.id])

  const headerTitle = loading ? "Comments" : `${entries.length} comments`

  const submit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || posting) return
      setPosting(true)
      try {
        const comment = await contentService.recordComment(clip.id, trimmed)
        setEntries((prev) => [comment, ...prev])
        setInput("")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "We couldn't post your encouragement. Please try again in a moment."
        window.alert(message)
      } finally {
        setPosting(false)
      }
    },
    [clip.id, input, posting]
  )

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <div className={styles.sheetPanel}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3 className={styles.sheetTitle}>{headerTitle}</h3>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close comments">
            ✕
          </button>
        </div>
        <div className={styles.sheetBody}>
          {loading ? <div className={styles.sheetStatus}>Loading comments...</div> : null}
          {error ? <div className={`${styles.sheetStatus} ${styles.sheetError}`}>{error}</div> : null}
          {!loading && !error && entries.length === 0 ? (
            <div className={styles.sheetStatus}>Be the first to encourage this creator.</div>
          ) : null}
          {entries.map((entry) => (
            <div key={entry.id} className={styles.commentItem}>
              <div className={styles.commentAvatar}>{(entry.user.name || "Friend").slice(0, 1).toUpperCase()}</div>
              <div className={styles.commentContent}>
                <div className={styles.commentHeader}>
                  <span>{entry.user.name}</span>
                  <span className={styles.commentMeta}>
                    {entry.user.handle ? `@${entry.user.handle}` : "Verified listener"} •{" "}
                    {formatRelativeTime(entry.createdAt, true)}
                  </span>
                </div>
                <p className={styles.commentText}>{entry.body}</p>
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
            <button type="submit" className={styles.donateConfirm} disabled={!input.trim() || posting}>
              {posting ? "Posting..." : "Post"}
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
            ✕
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
