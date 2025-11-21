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

const ADMIN_STORAGE_KEY = "vessel_admin_access"

export default function App() {
  const location = useLocation()
  const hideNavRoutes = ["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password"]
  const showChromeNav = !hideNavRoutes.includes(location.pathname)
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
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/friends" element={<Feed />} />
          <Route path="/home" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/inbox" element={<Inbox />} />
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
            <span className={styles.bottomIconCircle}>D</span>
            <span>Discover</span>
          </NavLink>

          <NavLink
            to="/friends"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle}>F</span>
            <span>Friends</span>
          </NavLink>

          <NavLink
            to="/upload"
            className={({ isActive }) =>
              isActive
                ? `${styles.bottomLink} ${styles.bottomLinkPrimary} ${styles.bottomLinkActive}`
                : `${styles.bottomLink} ${styles.bottomLinkPrimary}`
            }
          >
            <span className={styles.bottomIconCircle}>+</span>
          </NavLink>

          <NavLink
            to="/inbox"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle}>I</span>
            <span className={styles.badgedLabel}>
              Inbox <span className={styles.badge}>9</span>
            </span>
          </NavLink>

          <NavLink
            to="/profile/me"
            className={({ isActive }) =>
              isActive ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
          >
            <span className={styles.bottomIconCircle}>P</span>
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
        <header className={styles.adminHeader}>
          <p>Restricted Access</p>
          <h1>Enter Admin Credentials</h1>
          <p>This preview build is currently locked. Only authorized team members may proceed.</p>
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
              placeholder=""
              disabled={busy}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className={styles.adminError}>{error}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? "Verifying..." : "Unlock Preview"}
          </button>
        </form>

        <div className={styles.adminHelper}>
          <p>Need access?</p>
          <p>
            Contact <a href="mailto:support@godlyme.com">support@godlyme.com</a> for the latest admin credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
