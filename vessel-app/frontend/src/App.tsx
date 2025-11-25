import React from "react"
import { Routes, Route, NavLink, useLocation } from "react-router-dom"
import Feed from "./screens/Feed"
import Watch from "./pages/Watch"
import Upload from "./pages/Upload"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Signup from "./pages/Signup"
import VerifyEmail from "./pages/VerifyEmail"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Settings from "./pages/Settings"
import Inbox from "./pages/Inbox"
import styles from "./App.module.css"
import { contentService } from "./services/contentService"
import { Media } from "./media"
import { SvgDiscover, PlusIcon, SvgInbox, SvgPerson } from "./shared/icons"

const ADMIN_STORAGE_KEY = "vessel_admin_access"
const NAV_HIDDEN_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
])

export default function App() {
  const location = useLocation()
  const showChromeNav = !NAV_HIDDEN_ROUTES.has(location.pathname)
  const isFeedLayout = location.pathname === "/" || location.pathname === "/friends"
  const [unreadBadge, setUnreadBadge] = React.useState<string | null>(null)
  const [adminUnlocked, setAdminUnlocked] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(ADMIN_STORAGE_KEY) === "granted"
  })
  const [adminChecked, setAdminChecked] = React.useState(typeof window === "undefined" ? false : true)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    setAdminUnlocked(window.localStorage.getItem(ADMIN_STORAGE_KEY) === "granted")
    setAdminChecked(true)
  }, [])

  React.useEffect(() => {
    if (!contentService.isAuthenticated()) {
      setUnreadBadge(null)
      return
    }
    let cancelled = false
    async function loadUnread() {
      try {
        const threads = await contentService.fetchMessageThreads()
        if (cancelled) return
        const unreadCount = threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0)
        setUnreadBadge(unreadCount > 0 ? String(unreadCount) : null)
      } catch {
        if (!cancelled) return
      }
    }
    loadUnread()
    const unsubscribe = contentService.subscribe(loadUnread)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const handleUnlock = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_STORAGE_KEY, "granted")
    }
    setAdminUnlocked(true)
  }, [])

  if (!adminChecked) {
    return <div className={styles.app} />
  }

  if (!adminUnlocked) {
    return (
      <div className={styles.app}>
        <AdminGate onUnlock={handleUnlock} />
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <main className={isFeedLayout ? `${styles.main} ${styles.mainFeed}` : styles.main}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/friends" element={<Feed />} />
          <Route path="/home" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/inbox" element={<Inbox />} />
          {/* Alias for users navigating to /messages directly */}
          <Route path="/messages" element={<Inbox />} />
          <Route path="/profile/:id/settings" element={<Settings />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </main>

      {showChromeNav ? (
        <nav className={styles.bottomNav}>
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle} aria-hidden>
              <SvgDiscover width={20} height={20} />
            </span>
            <span>Discover</span>
          </NavLink>

          <NavLink
            to="/upload"
            className={({ isActive }) =>
              isActive
                ? `${styles.bottomLink} ${styles.bottomLinkPrimary} ${styles.bottomLinkActive}`
                : `${styles.bottomLink} ${styles.bottomLinkPrimary}`
            }
          >
            <span className={styles.bottomIconCircle} aria-hidden>
              <PlusIcon width={18} height={18} />
            </span>
          </NavLink>

          <NavLink
            to="/inbox"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle} aria-hidden>
              <SvgInbox width={20} height={20} />
            </span>
            <span className={styles.badgedLabel}>
              Inbox {unreadBadge ? <span className={styles.badge}>{unreadBadge}</span> : null}
            </span>
          </NavLink>

          <NavLink
            to="/profile/me"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle} aria-hidden>
              <SvgPerson width={20} height={20} />
            </span>
            <span>Profile</span>
          </NavLink>
        </nav>
      ) : null}
    </div>
  )
}

type AdminGateProps = {
  onUnlock: () => void
}

function AdminGate({ onUnlock }: AdminGateProps) {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const expectedUser = (import.meta.env.VITE_ADMIN_USER || "admin").trim().toLowerCase()
    const expectedPass = import.meta.env.VITE_ADMIN_PASS || "Money2026!"
    const providedUser = username.trim().toLowerCase()

    if (!providedUser || !password) {
      setError("Enter your admin username and password.")
      return
    }

    setBusy(true)
    setError(null)

    window.setTimeout(() => {
      if (providedUser === expectedUser && password === expectedPass) {
        onUnlock()
        return
      }

      setError("Invalid admin credentials.")
      setBusy(false)
    }, 200)
  }

  return (
    <div className={styles.adminLock}>
      <div className={styles.adminPanel}>
        <section className={styles.adminHero}>
          <span className={styles.adminHeroBadge}>Preview build</span>
          <div className={styles.adminHeroLogo}>
            <img src={Media.icons.logo} alt="Godlyme logo" />
          </div>
          <h1>Admin lock enabled</h1>
          <p>We keep pre-release builds gated while content, moderation, and payments finish review.</p>
          <ul className={styles.adminHeroChecklist}>
            <li>Live data protected</li>
            <li>AI moderation calibration</li>
            <li>Private testing sessions</li>
          </ul>
          <div className={styles.adminHeroFooter}>
            <span>
              Build channel: <strong>Godlyme</strong>
            </span>
            <span>
              Status: <strong>Invite only</strong>
            </span>
          </div>
        </section>

        <section className={styles.adminPanelBody}>
          <header className={styles.adminHeader}>
            <p>Restricted Access</p>
            <h2>Enter Admin Credentials</h2>
            <p>Only authorized team members can unlock this session.</p>
          </header>

          <form className={styles.adminForm} onSubmit={handleSubmit}>
            <label className={styles.adminField}>
              <span>Admin username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username required"
                disabled={busy}
                autoComplete="username"
              />
            </label>
            <label className={styles.adminField}>
              <span>Passphrase</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passphrase"
                disabled={busy}
                autoComplete="current-password"
              />
            </label>
            {error ? <p className={styles.adminError}>{error}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? "Verifying..." : "Unlock preview"}
            </button>
          </form>

          <div className={styles.adminHelper}>
            <span>Need access?</span>
            <p>
              Email <a href="mailto:support@godlyme.com">support@godlyme.com</a> for the latest admin credentials.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
