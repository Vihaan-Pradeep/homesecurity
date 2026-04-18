import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
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

// Heatmap tuning — treat anything under NEAR_CM as "very hot", over FAR_CM as "cold".
const NEAR_CM = 20
const FAR_CM  = 200

function intensity(cm) {
  if (!cm || cm <= 0) return 0
  const v = 1 - (cm - NEAR_CM) / (FAR_CM - NEAR_CM)
  return Math.max(0, Math.min(1, v))
}

function zoneStatus(z, armed) {
  if (!armed) return 'clear'
  if (z.ir && z.motion) return 'intruder'
  if (z.motion || z.ir)  return 'motion'
  return 'clear'
}

function formatClock(d) {
  return (
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0')
  )
}

// Classic "jet" colormap: 0 -> dark blue, 0.5 -> green, 1 -> red.
function jet(v) {
  v = Math.max(0, Math.min(1, v))
  const r = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.75)))))
  const g = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.5)))))
  const b = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.25)))))
  return [r, g, b]
}

// Draws a rough human silhouette (head + torso + arms + legs) onto a canvas path.
function silhouettePath(ctx, W, H) {
  ctx.beginPath()
  // head
  ctx.arc(W * 0.5, H * 0.13, H * 0.08, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fill()

  // torso
  ctx.beginPath()
  ctx.moveTo(W * 0.35, H * 0.22)
  ctx.quadraticCurveTo(W * 0.5, H * 0.2,  W * 0.65, H * 0.22)
  ctx.lineTo(W * 0.68, H * 0.55)
  ctx.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.32, H * 0.55)
  ctx.closePath()
  ctx.fill()

  // left arm
  ctx.beginPath()
  ctx.moveTo(W * 0.36, H * 0.24)
  ctx.quadraticCurveTo(W * 0.18, H * 0.35, W * 0.12, H * 0.52)
  ctx.lineTo(W * 0.2,  H * 0.53)
  ctx.quadraticCurveTo(W * 0.28, H * 0.38, W * 0.4,  H * 0.28)
  ctx.closePath()
  ctx.fill()

  // right arm (mirror)
  ctx.beginPath()
  ctx.moveTo(W * 0.64, H * 0.24)
  ctx.quadraticCurveTo(W * 0.82, H * 0.35, W * 0.88, H * 0.52)
  ctx.lineTo(W * 0.8,  H * 0.53)
  ctx.quadraticCurveTo(W * 0.72, H * 0.38, W * 0.6,  H * 0.28)
  ctx.closePath()
  ctx.fill()

  // legs
  ctx.beginPath()
  ctx.moveTo(W * 0.36, H * 0.58)
  ctx.quadraticCurveTo(W * 0.42, H * 0.8, W * 0.42, H * 0.96)
  ctx.lineTo(W * 0.5,  H * 0.96)
  ctx.lineTo(W * 0.5,  H * 0.58)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(W * 0.64, H * 0.58)
  ctx.quadraticCurveTo(W * 0.58, H * 0.8, W * 0.58, H * 0.96)
  ctx.lineTo(W * 0.5,  H * 0.96)
  ctx.lineTo(W * 0.5,  H * 0.58)
  ctx.closePath()
  ctx.fill()
}

function PresenceHeatmap({ zones }) {
  const canvasRef = useRef(null)
  const W = 220
  const H = 340

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // offscreen: compute heatmap
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const octx = off.getContext('2d')
    const img = octx.createImageData(W, H)
    const data = img.data

    const sensors = [
      { x: W * 0.5, y: H * 0.15, v: intensity(zones.zone1?.ultrasonic) },
      { x: W * 0.5, y: H * 0.45, v: intensity(zones.zone2?.ultrasonic) },
      { x: W * 0.5, y: H * 0.8,  v: intensity(zones.zone3?.ultrasonic) },
    ]

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let num = 0, den = 0
        for (const s of sensors) {
          const dx = x - s.x
          const dy = y - s.y
          const d2 = dx * dx + dy * dy + 1
          const w = 1 / (d2 * d2)
          num += w * s.v
          den += w
        }
        const v = num / den
        const [r, g, b] = jet(v)
        const i = (y * W + x) * 4
        data[i]     = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
    octx.putImageData(img, 0, 0)

    // main canvas: background
    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, W, H)

    // silhouette mask
    ctx.save()
    ctx.fillStyle = '#fff'
    silhouettePath(ctx, W, H)
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(off, 0, 0)
    ctx.restore()

    // soft glow outline
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    silhouettePath(ctx, W, H)
    ctx.restore()
  }, [zones])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto', imageRendering: 'auto', filter: 'blur(1.5px)' }}
    />
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
  const anyPresent = Object.values(zones).some((z) => intensity(z.ultrasonic) > 0.1)

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
