import { Hct, redFromArgb, greenFromArgb, blueFromArgb } from "@material/material-color-utilities"

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [(r * 255), (g * 255), (b * 255)];
}
function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
export default function initPicker() {
  const canvas = document.getElementById("picker-canvas") as HTMLCanvasElement || null
  if (canvas === null) {
    alert("no canvas found")
    return
  }
  if (Number(canvas.width) > Number(canvas.height)) {
    canvas.width = canvas.height
  } else {
    canvas.height = canvas.width
  }
  const width = Number(canvas.width)
  const height = Number(canvas.height)
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    alert("unable to get canvas context")
    return
  }
  let data = ctx.createImageData(width, height)
  for (let val = 0; val < data.data.length; val += 4) {
    let i = val / 4
    let y = Math.floor(i / width)
    let x = i % width
    let dx = x / width * 2 - 1
    let dy = y / height * 2 - 1
    let radius = Math.sqrt((dx * dx) + (dy * dy))
    let angle = Math.asin(dy / radius) / Math.PI * 180
    if (dx < 0) {
      angle = 180 - angle
    }
    let color = Hct.from(angle, radius * 90, 100 - radius * 30).toInt()
    data.data[val + 0] = redFromArgb(color) // red
    data.data[val + 1] = greenFromArgb(color) // green
    data.data[val + 2] = blueFromArgb(color) // blue
    data.data[val + 3] = 255 // alpha
  }
  ctx.putImageData(data, 0, 0)
  const preview = document.getElementById("selector") as HTMLElement
  function doCursorMove(e: PointerEvent) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left - 8
    const y = e.clientY - rect.top - 8
    const { data: color } = ctx!.getImageData(x, y, 1, 1)
    preview.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    preview.style.left = (e.pageX - 8).toString() + "px"
    preview.style.top = (e.pageY - 8).toString() + "px"
  }
  canvas.addEventListener("mousedown", function(e) {
    canvas.style.cursor = "none"
    preview.style.visibility = "visible"
    doCursorMove(e as PointerEvent)
    canvas.addEventListener("pointermove", doCursorMove)
  })
  canvas.addEventListener("mouseup", function() {
    canvas.style.cursor = "default"
    canvas.removeEventListener("pointermove", doCursorMove)
  })
}
