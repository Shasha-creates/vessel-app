import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { contentService } from "../services/contentService"
import { COUNTRY_OPTIONS } from "../shared/countryOptions"
import styles from "./Signup.module.css"

export default function Signup() {
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [church, setChurch] = useState("")
  const [country, setCountry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const normalizedHandle = handle.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()

  useEffect(() => {
    if (!name.trim()) return
    if (!handle.trim()) {
      setHandle(contentService.suggestHandle(name))
    }
  }, [handle, name])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const passwordValue = password.trim()
    const confirmValue = confirmPassword.trim()
    const countryValue = country.trim()

    if (!trimmedName) {
      setError("Enter a display name")
      return
    }
    if (!normalizedHandle) {
      setError("Enter a handle")
      return
    }
    if (!trimmedEmail) {
      setError("Enter an email")
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError("Enter a valid email")
      return
    }
    if (passwordValue.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (passwordValue !== confirmValue) {
      setError("Passwords do not match")
      return
    }

    setBusy(true)
    try {
      await contentService.createAccount({
        name: trimmedName,
        handle: normalizedHandle,
        email: trimmedEmail,
        password: passwordValue,
        church,
        country: countryValue,
        photo: null,
      })
      setError(null)
      setSuccess(`Account created! We sent a verification code to ${trimmedEmail}.`)
      setVerificationEmail(trimmedEmail)
      setVerificationCode("")
      setVerificationError(null)
      setPassword("")
      setConfirmPassword("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save your profile right now."
      setError(message)
      setSuccess(null)
    } finally {
      setBusy(false)
    }
  }

  async function onVerifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (!verificationEmail) return
    const trimmedCode = verificationCode.trim()
    if (!trimmedCode) {
      setVerificationError("Enter the code from your email.")
      return
    }
    setVerificationBusy(true)
    try {
      await contentService.verifyEmailCode(verificationEmail, trimmedCode)
      setVerificationError(null)
      setSuccess("Email verified! You can now sign in.")
      window.setTimeout(() => navigate("/login"), 1200)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify that code right now."
      setVerificationError(message)
    } finally {
      setVerificationBusy(false)
    }
  }

  async function onResendCode() {
    if (!verificationEmail) return
    setVerificationBusy(true)
    try {
      await contentService.resendVerification(verificationEmail)
      setVerificationError(null)
      setSuccess(`We sent a new code to ${verificationEmail}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend the code right now."
      setVerificationError(message)
    } finally {
      setVerificationBusy(false)
    }
  }

  return (
    <div className={styles.signup}>
      <h1>Create your Vessel profile</h1>
      <p>Choose a display name so your worship moments and testimonies are linked to you.</p>
      {success ? <div className={styles.success}>{success}</div> : null}
      {verificationEmail ? (
        <div className={styles.verificationBox}>
          <p>
            Enter the 6-digit code we emailed to <strong>{verificationEmail}</strong> to activate your account.
          </p>
          <form className={styles.codeForm} onSubmit={onVerifyCode}>
            <input
              className={styles.codeInput}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              disabled={verificationBusy}
            />
            <button type="submit" disabled={verificationBusy || verificationCode.length < 6}>
              {verificationBusy ? "Verifying..." : "Verify email"}
            </button>
          </form>
          <button type="button" className={styles.linkButton} onClick={onResendCode} disabled={verificationBusy}>
            Resend code
          </button>
          {verificationError ? <div className={styles.error}>{verificationError}</div> : null}
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hope Chapel Youth" disabled={busy} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} />
        </label>
        <label>
          <span>Handle</span>
          <div className={styles.handleRow}>
            <span>@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="hopechapel" disabled={busy} />
          </div>
          <small>Letters, numbers, underscores only.</small>
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            disabled={busy}
          />
        </label>
        <label>
          <span>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            disabled={busy}
          />
        </label>
        <label>
          <span>Church / Community (optional)</span>
          <input value={church} onChange={(e) => setChurch(e.target.value)} placeholder="River City Church" disabled={busy} />
        </label>
        <label>
          <span>Country</span>
          <input
            type="text"
            list="country-options"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Select or type your country"
            disabled={busy}
          />
          <datalist id="country-options">
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        {error ? <div className={styles.error}>{error}</div> : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? "Creating account..." : "Sign up"}
        </button>
        <button type="button" className={styles.secondary} onClick={() => navigate("/login")} disabled={busy}>
          I already have an account
        </button>
        </form>
      )}
    </div>
  )
}
