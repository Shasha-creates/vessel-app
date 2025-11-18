import React, { useState } from "react"
import { Link } from "react-router-dom"
import { contentService } from "../services/contentService"
import styles from "./Login.module.css"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Enter the email on your account.")
      return
    }
    setBusy(true)
    try {
      await contentService.requestPasswordReset(trimmedEmail)
      setStatus("If an account exists for that email, we sent instructions to reset your password.")
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send reset instructions right now."
      setError(message)
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.login}>
      <h1>Forgot password</h1>
      <p className={styles.subtitle}>Enter the email you used on Vessel and we’ll send you a reset link.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />
        </label>
        {status ? <div className={styles.success}>{status}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.actions}>
          <button type="submit" disabled={busy}>
            {busy ? "Sending link..." : "Send reset link"}
          </button>
          <Link className={styles.secondaryLink} to="/login">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  )
}
