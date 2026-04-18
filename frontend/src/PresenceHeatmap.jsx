import { useEffect, useRef } from 'react'
import HeatmapWorker from './heatmap.worker.js?worker'

// Tuning
const W = 220
const H = 340
const NEAR_CM = 30   // anything closer than this = red hot
const FAR_CM  = 150  // anything farther than this = cold blue

function intensity(cm) {
  if (!cm || cm <= 0) return 0
  const v = 1 - (cm - NEAR_CM) / (FAR_CM - NEAR_CM)
  return Math.max(0, Math.min(1, v))
}

// Rough human silhouette drawn on a path — used as an alpha mask.
function silhouettePath(ctx) {
  ctx.beginPath()
  ctx.arc(W * 0.5, H * 0.13, H * 0.08, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(W * 0.35, H * 0.22)
  ctx.quadraticCurveTo(W * 0.5, H * 0.2,  W * 0.65, H * 0.22)
  ctx.lineTo(W * 0.68, H * 0.55)
  ctx.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.32, H * 0.55)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(W * 0.36, H * 0.24)
  ctx.quadraticCurveTo(W * 0.18, H * 0.35, W * 0.12, H * 0.52)
  ctx.lineTo(W * 0.2,  H * 0.53)
  ctx.quadraticCurveTo(W * 0.28, H * 0.38, W * 0.4,  H * 0.28)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(W * 0.64, H * 0.24)
  ctx.quadraticCurveTo(W * 0.82, H * 0.35, W * 0.88, H * 0.52)
  ctx.lineTo(W * 0.8,  H * 0.53)
  ctx.quadraticCurveTo(W * 0.72, H * 0.38, W * 0.6,  H * 0.28)
  ctx.closePath()
  ctx.fill()

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

// --- WebGL path ------------------------------------------------------------

const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = (aPos + 1.0) * 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform vec3 uSy;
uniform vec3 uSv;
uniform float uTime;
out vec4 outColor;

float jetChannel(float v, float center) {
  return clamp(1.5 - abs(4.0 * (v - center)), 0.0, 1.0);
}

// cheap hash noise for grain/shimmer
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);

  // 1D vertical IDW: each sensor influences a horizontal band.
  float num = 0.0;
  float den = 0.0;
  for (int i = 0; i < 3; i++) {
    float dy = p.y - uSy[i];
    float w  = 1.0 / (dy * dy + 600.0);  // broad bands
    num += w * uSv[i];
    den += w;
  }
  float v = num / den;

  // Horizontal falloff from center (thermal is brighter at the core)
  float cx = (p.x / uRes.x - 0.5) * 2.0;
  float center = 1.0 - 0.35 * cx * cx;
  v *= center;

  // Gamma boost so even mid-distance readings look warm
  v = pow(clamp(v, 0.0, 1.0), 0.7);

  // Subtle shimmer
  float n = hash(floor(p * 0.8) + floor(uTime * 2.0));
  v += (n - 0.5) * 0.06;
  v = clamp(v, 0.0, 1.0);

  outColor = vec4(
    jetChannel(v, 0.75),
    jetChannel(v, 0.5),
    jetChannel(v, 0.25),
    1.0
  );
}
`

function initGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })
  if (!gl) return null

  const compile = (type, src) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('shader error:', gl.getShaderInfoLog(sh))
      return null
    }
    return sh
  }

  const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vs || !fs) return null

  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('link error:', gl.getProgramInfoLog(prog))
    return null
  }
  gl.useProgram(prog)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  return {
    gl,
    prog,
    uRes:  gl.getUniformLocation(prog, 'uRes'),
    uSy:   gl.getUniformLocation(prog, 'uSy'),
    uSv:   gl.getUniformLocation(prog, 'uSv'),
    uTime: gl.getUniformLocation(prog, 'uTime'),
  }
}

// --- React component -------------------------------------------------------

export default function PresenceHeatmap({ zones }) {
  const mainRef = useRef(null)
  const heatRef = useRef(null)      // offscreen canvas holding heatmap pixels
  const glRef = useRef(null)        // { gl, prog, uniforms } if WebGL available
  const workerRef = useRef(null)    // fallback worker
  const rafRef = useRef(0)
  const latestRef = useRef(null)    // latest zones input, for rAF batching
  const jobIdRef = useRef(0)

  // Init offscreen canvas + try WebGL, else set up worker.
  useEffect(() => {
    const heat = document.createElement('canvas')
    heat.width = W
    heat.height = H
    heatRef.current = heat

    const glBundle = initGL(heat)
    if (glBundle) {
      glRef.current = glBundle
      const { gl, uRes } = glBundle
      gl.viewport(0, 0, W, H)
      gl.uniform2f(uRes, W, H)
      console.log('[heatmap] using WebGL2')
    } else {
      const worker = new HeatmapWorker()
      worker.onmessage = (ev) => {
        const { jobId, w, h, buf } = ev.data
        if (jobId !== jobIdRef.current) return  // stale
        const ctx = heatRef.current.getContext('2d')
        const img = new ImageData(new Uint8ClampedArray(buf), w, h)
        ctx.putImageData(img, 0, 0)
        composite()
      }
      workerRef.current = worker
      console.log('[heatmap] using Web Worker fallback')
    }

    return () => {
      if (workerRef.current) workerRef.current.terminate()
    }
  }, [])

  // Keep the latest zones in a ref; GPU path uses rAF loop for shimmer.
  useEffect(() => { latestRef.current = zones }, [zones])

  // GPU path: continuous rAF loop for the shimmer animation.
  // Worker path: render only when zones change (event-driven).
  useEffect(() => {
    if (glRef.current) {
      let running = true
      const loop = (t) => {
        if (!running) return
        renderGL(latestRef.current, t * 0.001)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
      return () => { running = false; cancelAnimationFrame(rafRef.current) }
    }
  }, [])

  useEffect(() => {
    if (!glRef.current && workerRef.current) {
      const z = zones
      const sy = [H * 0.2, H * 0.5, H * 0.85]
      const sv = [intensity(z.zone1?.ultrasonic), intensity(z.zone2?.ultrasonic), intensity(z.zone3?.ultrasonic)]
      jobIdRef.current++
      workerRef.current.postMessage({
        jobId: jobIdRef.current, w: W, h: H,
        sx: [W * 0.5, W * 0.5, W * 0.5], sy, sv,
      })
    }
  }, [zones])

  function renderGL(z, time) {
    if (!z) return
    const { gl, uSy, uSv, uTime } = glRef.current
    gl.uniform3f(uSy, H * 0.2, H * 0.5, H * 0.85)
    gl.uniform3f(uSv,
      intensity(z.zone1?.ultrasonic),
      intensity(z.zone2?.ultrasonic),
      intensity(z.zone3?.ultrasonic))
    gl.uniform1f(uTime, time)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    composite()
  }

  function composite() {
    const main = mainRef.current
    const heat = heatRef.current
    if (!main || !heat) return
    const ctx = main.getContext('2d')

    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.fillStyle = '#fff'
    silhouettePath(ctx)
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(heat, 0, 0)
    ctx.restore()
  }

  return (
    <canvas
      ref={mainRef}
      width={W}
      height={H}
      style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto', filter: 'blur(1.5px)' }}
    />
  )
}
