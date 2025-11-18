import React, { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { contentService } from "../services/contentService"
import styles from "./Login.module.css"

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialToken = searchParams.get("token") ?? ""
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedPassword = password.trim()
    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (trimmedPassword !== confirmPassword.trim()) {
      setError("Passwords do not match.")
      return
    }
    setBusy(true)
    try {
      await contentService.resetPassword(token, trimmedPassword)
      setStatus("Password updated! Redirecting to your profile...")
      setError(null)
      window.setTimeout(() => navigate("/profile/me"), 1400)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to reset your password right now."
      setError(message)
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.login}>
      <h1>Create a new password</h1>
      <p className={styles.subtitle}>Choose a new password to regain access to your Vessel account.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Reset token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the token from your email"
            disabled={busy || Boolean(initialToken)}
          />
        </label>
        <label>
          <span>New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </label>
        <label>
          <span>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        {status ? <div className={styles.success}>{status}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.actions}>
          <button type="submit" disabled={busy}>
            {busy ? "Updating..." : "Update password"}
          </button>
          <Link className={styles.secondaryLink} to="/login">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
