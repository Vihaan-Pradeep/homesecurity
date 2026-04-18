// CPU fallback: computes a jet-colored IDW heatmap off the main thread.
// Expects messages: { w, h, sx: [x1,x2,x3], sy: [y1,y2,y3], sv: [v1,v2,v3] }
// Replies with a transferable ImageData-like payload.

function jet(v) {
  v = Math.max(0, Math.min(1, v))
  const r = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.75)))))
  const g = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.5)))))
  const b = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * (v - 0.25)))))
  return [r, g, b]
}

self.onmessage = (ev) => {
  const { w, h, sx, sy, sv, jobId } = ev.data
  const buf = new Uint8ClampedArray(w * h * 4)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let num = 0, den = 0
      for (let i = 0; i < 3; i++) {
        const dx = x - sx[i]
        const dy = y - sy[i]
        const d2 = dx * dx + dy * dy + 1
        const ww = 1 / (d2 * d2)
        num += ww * sv[i]
        den += ww
      }
      const v = num / den
      const [r, g, b] = jet(v)
      const p = (y * w + x) * 4
      buf[p]     = r
      buf[p + 1] = g
      buf[p + 2] = b
      buf[p + 3] = 255
    }
  }

  // Transfer the underlying ArrayBuffer to avoid a copy.
  self.postMessage({ jobId, w, h, buf: buf.buffer }, [buf.buffer])
}
