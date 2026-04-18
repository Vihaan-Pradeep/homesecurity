import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io('/', { path: '/socket.io' })
const ALERT_DISTANCE = 100

export default function App() {
  const [distance, setDistance] = useState(null)
  const [armed, setArmed] = useState(false)
  const [events, setEvents] = useState([{ time: '--:--:--', msg: 'System initialized.', level: 'info' }])
  const [connected, setConnected] = useState(false)
  const [clock, setClock] = useState('')

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state_update', (data) => {
      setArmed(data.armed)
      setDistance(data.zones.zone1.ultrasonic || null)
      if (data.events?.length) setEvents(data.events.slice(0, 30))
    })
    return () => socket.off()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date()
      setClock(
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0')
      )
    }, 1000)
    return () => clearInterval(t)
  }, [])

  function toggleArm() {
    fetch('/arm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ armed: !armed }),
    })
  }

  const isAlert = armed && distance !== null && distance < ALERT_DISTANCE
  const status = !armed ? 'disarmed' : isAlert ? 'intruder' : 'clear'

  const statusText = {
    disarmed: 'DISARMED — monitoring paused',
    clear: 'ARMED — zone clear',
    intruder: `ALERT — object detected at ${distance}cm`,
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1z" stroke="#3b82f6" strokeWidth="1.2"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">HomeShield</div>
            <div className="logo-sub">security dashboard</div>
          </div>
        </div>
        <div className="header-right">
          <span className="conn-dot" style={{ background: connected ? '#22c55e' : '#6b7280' }} title={connected ? 'Connected' : 'Disconnected'} />
          <span className="clock">{clock}</span>
          <button className={`arm-btn ${armed ? 'armed' : 'disarmed'}`} onClick={toggleArm}>
            {armed ? 'DISARM' : 'ARM SYSTEM'}
          </button>
        </div>
      </header>

      <div className={`status-bar s-${status}`}>
        <div className={`pulse p-${status}`} />
        <span>{statusText[status]}</span>
      </div>

      <div className="main-grid">
        <div className={`zone-card z-${status}`}>
          <div className="zone-header">
            <span className="zone-name">Zone 1 — Front Door</span>
            <span className={`badge b-${status}`}>
              {status === 'disarmed' ? 'Standby' : status === 'clear' ? 'Clear' : 'ALERT'}
            </span>
          </div>

          <div className={`dist-num dn-${status}`}>{distance ?? '--'}</div>
          <div className="dist-label">cm distance</div>

          <div className="range-bar">
            <div
              className="range-fill"
              style={{
                width: distance ? `${Math.min(100, (distance / 400) * 100)}%` : '0%',
                background: isAlert ? '#ef4444' : '#22c55e',
                transition: 'width 0.4s, background 0.3s',
              }}
            />
          </div>
          <div className="range-labels">
            <span>0cm</span>
            <span>alert &lt;{ALERT_DISTANCE}cm</span>
            <span>400cm</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Event Log</div>
          <div className="log">
            {events.map((e, i) => (
              <div className="log-entry" key={i}>
                <span className="log-time">{e.time}</span>
                <div className={`log-dot dot-${e.level}`} />
                <span className="log-msg">{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
