import React from "react"
import { Routes, Route, NavLink, useLocation } from "react-router-dom"
import Feed from "./screens/Feed"
import Watch from "./pages/Watch"
import Upload from "./pages/Upload"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Home from "./pages/Home"
import Signup from "./pages/Signup"
import Settings from "./pages/Settings"
import Inbox from "./pages/Inbox"
import styles from "./App.module.css"

export default function App() {
  const location = useLocation()
  const showChromeNav = location.pathname !== "/"

  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/home" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/profile/:id/settings" element={<Settings />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
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
