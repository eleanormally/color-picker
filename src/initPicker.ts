import {
  Hct,
  redFromArgb,
  greenFromArgb,
  blueFromArgb,
} from "@material/material-color-utilities"
import {
  addVec,
  changeInterpFunction,
  createAnimation,
  getSlerp,
  getStateTree,
  mag,
  modifyTo,
  mulScalar,
  newVec2,
  normalize,
  subVec,
  Vec2,
  ZERO_VEC2,
} from "aninest"
import {
  getUpdateLayer,
  localMomentumLayer,
  restrictFromFunctionExtension,
} from "@aninest/extensions"
export default function initPicker() {
  const canvas =
    (document.getElementById("picker-canvas") as HTMLCanvasElement) || null
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
  const ctx = canvas.getContext("2d")
  if (ctx === null) {
    alert("unable to get canvas context")
    return
  }
  let data = ctx.createImageData(width, height)

  for (let val = 0; val < data.data.length; val += 4) {
    let i = val / 4
    let y = Math.floor(i / width)
    let x = i % width
    let dx = (x / width) * 2 - 1
    let dy = (y / height) * 2 - 1
    let radius = Math.sqrt(dx * dx + dy * dy)
    let angle = (Math.asin(dy / radius) / Math.PI) * 180
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
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left - 8
    const y = e.clientY - rect.top - 8
    let v = { x, y }
    if (mag(v) > width / 2) v = mulScalar(normalize(v), width / 2)
    modifyTo(anim, { x, y })
  }
  type Anim = Vec2
  const anim = createAnimation<Anim>(
    newVec2(canvas.width / 2, canvas.height / 2),
    getSlerp(0.05)
  )
  const updateLayer = getUpdateLayer<Anim>()
  const momentumLayer = localMomentumLayer(0.5, canvas.width)
  updateLayer.subscribe("update", anim => {
    const { x, y } = getStateTree(anim)
    const { data: color } = ctx!.getImageData(x, y, 1, 1)
    preview.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    preview.style.transform = `translate(${x}px, ${y}px)`
    // preview.style.left = x + "px"
    // preview.style.top = y + "px"
  })
  const restrictExtension = restrictFromFunctionExtension<Anim>(state => {
    const center = newVec2(canvas.width / 2, canvas.height / 2)
    const fromCenter = subVec(state, center)
    if (mag(fromCenter) > canvas.width / 2) {
      const fromTopLeft = addVec(
        mulScalar(normalize(fromCenter), width / 2 - Number.EPSILON * width),
        center
      )
      const vel = momentumLayer.getVelocity()
      if (vel == 0) {
        modifyTo(anim, fromTopLeft)
        return
      }
      const start = getStateTree(anim)
      const end = fromTopLeft
      const fromEnd = subVec(start, end)
      const dist = mag(fromEnd)
      changeInterpFunction(anim, getSlerp(dist / vel))
      modifyTo(anim, fromTopLeft)
    }
  })
  updateLayer.mount(anim)
  momentumLayer.mount(anim)
  restrictExtension(anim)
  canvas.addEventListener("pointerdown", function (e) {
    canvas.style.cursor = "none"
    preview.style.visibility = "visible"
    doCursorMove(e as PointerEvent)
    window.addEventListener("pointermove", doCursorMove)
    setTimeout(() => {
      momentumLayer.clearRecordedStates()
    }, 50)
    window.addEventListener(
      "pointerup",
      function () {
        canvas.style.cursor = "default"
        momentumLayer.startGlide()
        window.removeEventListener("pointermove", doCursorMove)
      },
      { once: true }
    )
  })
}
