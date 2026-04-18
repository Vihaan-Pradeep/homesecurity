import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import PresenceHeatmap from './PresenceHeatmap.jsx'
import './App.css'

const socket = io('/', { path: '/socket.io' })

// Sensors are stacked vertically, pointing at roughly the same spot:
//   zone1 = upper band (head/shoulders)
//   zone2 = middle band (torso)
//   zone3 = lower band (legs)
const ZONE_META = [
  { key: 'zone1', n: 1, name: 'Upper — head / shoulders' },
  { key: 'zone2', n: 2, name: 'Middle — torso' },
  { key: 'zone3', n: 3, name: 'Lower — legs' },
]

const BADGE_LABEL = { clear: 'Clear', motion: 'Motion', intruder: 'PRESENT' }

function zoneStatus(z, armed) {
  if (!armed) return 'clear'
  if (z.ir && z.motion) return 'intruder'
  if (z.motion || z.ir)  return 'motion'
  return 'clear'
}

function isPresent(cm) {
  return cm > 0 && cm < 180
}

function formatClock(d) {
  return (
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0')
  )
}

export default function App() {
  const [armed, setArmed] = useState(false)
  const [zones, setZones] = useState({
    zone1: { ultrasonic: 0, ir: false, motion: false, qdist: false, qmot: false },
    zone2: { ultrasonic: 0, ir: false, motion: false, qdist: false, qmot: false },
    zone3: { ultrasonic: 0, ir: false, motion: false, qdist: false, qmot: false },
  })
  const [events, setEvents] = useState([{ time: '--:--:--', msg: 'System initialized.', level: 'info' }])
  const [connected, setConnected] = useState(false)
  const [clock, setClock] = useState('--:--:--')

  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state_update', (data) => {
      setArmed(!!data.armed)
      if (data.zones) setZones((prev) => ({ ...prev, ...data.zones }))
      if (Array.isArray(data.events)) setEvents(data.events.slice(0, 30))
    })
    return () => socket.off()
  }, [])

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  function toggleArm() {
    fetch('/arm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ armed: !armed }),
    })
  }

  const zoneStates = ZONE_META.map((m) => ({ ...m, z: zones[m.key], status: zoneStatus(zones[m.key], armed) }))
  const anyPresent = Object.values(zones).some((z) => isPresent(z.ultrasonic))

  const bar = !armed
    ? { cls: 'disarmed', text: 'SYSTEM DISARMED — monitoring paused' }
    : anyPresent
      ? { cls: 'alert', text: 'PRESENCE DETECTED' }
      : { cls: 'armed', text: 'SYSTEM ARMED — area clear' }

  return (
    <>
      <div className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L2 4v4c0 3.3 2.5 6.4 6 7 3.5-.6 6-3.7 6-7V4L8 1z" stroke="#3b82f6" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <div className="logo-text">HomeShield</div>
            <div className="logo-sub">security dashboard</div>
          </div>
        </div>
        <div className="header-right">
          <span className="conn-dot" style={{ background: connected ? '#22c55e' : '#6b7280' }} title={connected ? 'Connected' : 'Disconnected'} />
          <div className="clock">{clock}</div>
          <button className={`arm-btn ${armed ? 'armed' : 'disarmed'}`} onClick={toggleArm}>
            {armed ? 'DISARM SYSTEM' : 'ARM SYSTEM'}
          </button>
        </div>
      </div>

      <div className={`status-bar ${bar.cls}`}>
        <div className="pulse" />
        <span>{bar.text}</span>
      </div>

      <div className="zones-grid">
        {zoneStates.map(({ key, n, name, z, status }) => (
          <div key={key} className={`zone-card ${status}`}>
            <div className="zone-header">
              <span className="zone-name">{name}</span>
              <span className={`zone-badge badge-${status}`}>{BADGE_LABEL[status]}</span>
            </div>
            <div className={`dist-num ${status}`}>{z.ultrasonic > 0 ? z.ultrasonic : '--'}</div>
            <div className="dist-label">cm distance</div>
            <div className="sensor-row">
              <div className={`sensor-pill${z.ir ? ' active-ir' : ''}`}>IR</div>
              <div className={`sensor-pill${z.motion ? ' active-motion' : ''}`}>Motion</div>
              <div className={`sensor-pill${z.qdist ? ' active-dist' : ''}`}>Q-Dist</div>
              <div className={`sensor-pill${z.qmot ? ' active-motion' : ''}`}>Q-Mot</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bottom-grid">
        <div className="panel">
          <div className="panel-title">Presence Heatmap</div>
          <PresenceHeatmap zones={zones} />
          <div className="heatmap-legend">
            <span>cold</span>
            <div className="legend-gradient" />
            <span>hot</span>
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
    </>
  )
}
