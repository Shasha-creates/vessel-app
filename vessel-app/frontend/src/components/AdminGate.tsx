import React from "react"

type AdminGateProps = {
  children: React.ReactNode
}

const DEFAULT_ADMIN_USERNAME = "Admin"
const DEFAULT_ADMIN_PASSWORD = "Money2025!"

export function AdminGate({ children }: AdminGateProps) {
  const adminUser = (import.meta.env.VITE_ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME).trim()
  const adminPass = (import.meta.env.VITE_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD).trim()
  const gateEnabled = Boolean(adminUser && adminPass)
  const [authorized, setAuthorized] = React.useState(() => !gateEnabled)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (username.trim() === adminUser && password === adminPass) {
        setAuthorized(true)
        setError(null)
      } else {
        setError("Invalid admin credentials. Please try again.")
      }
    },
    [adminPass, adminUser, gateEnabled, password, username]
  )

  if (!gateEnabled || authorized) {
    return <>{children}</>
  }

  return (
    <div style={backdropStyle}>
      <form style={panelStyle} onSubmit={handleSubmit}>
        <h2 style={titleStyle}>Restricted Preview</h2>
        <p style={hintStyle}>Enter the admin credentials to view this Vessel test build.</p>
        <label style={labelStyle}>
          <span>Admin username</span>
          <input
            style={inputStyle}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label style={labelStyle}>
          <span>Admin password</span>
          <input
            style={inputStyle}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <div style={errorStyle}>{error}</div> : null}
        <button type="submit" style={buttonStyle}>
          Unlock
        </button>
      </form>
    </div>
  )
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "radial-gradient(circle at top, rgba(16,22,40,0.95), rgba(5,7,12,0.98))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "2rem",
}

const panelStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  background: "rgba(12,16,28,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "20px",
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.1rem",
  color: "white",
  boxShadow: "0 30px 80px -40px rgba(0,0,0,0.6)",
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  fontWeight: 700,
}

const hintStyle: React.CSSProperties = {
  margin: 0,
  color: "rgba(220,230,255,0.72)",
  lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(8,10,16,0.9)",
  color: "white",
  padding: "0.7rem 0.9rem",
  fontSize: "1rem",
}

const buttonStyle: React.CSSProperties = {
  borderRadius: "999px",
  border: "none",
  padding: "0.75rem 1.4rem",
  background: "linear-gradient(135deg, #6d8bff, #74f1ff)",
  color: "#0e1330",
  fontWeight: 700,
  cursor: "pointer",
}

const errorStyle: React.CSSProperties = {
  color: "#ff8a85",
  fontWeight: 600,
}
