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
  createParentAnimation,
  divScalar,
  getSlerp,
  getStateTree,
  mag,
  modifyTo,
  mulScalar,
  newVec2,
  NO_INTERP,
  normalize,
  subVec,
  Vec2,
} from "aninest"
import {
  distanceLessThan,
  getSnapPointLayer,
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
  const DPR = window.devicePixelRatio
  const width = canvas.width
  const height = canvas.height
  canvas.width *= DPR
  canvas.height *= DPR
  console.log(DPR)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext("2d")
  if (ctx === null) {
    alert("unable to get canvas context")
    return
  }
  let data = ctx.createImageData(canvas.width, canvas.height)

  for (let val = 0; val < data.data.length; val += 4) {
    let i = val / 4
    let y = Math.floor(i / canvas.width)
    let x = i % canvas.width
    let dx = (x / canvas.width) * 2 - 1
    let dy = (y / canvas.height) * 2 - 1
    let radius = Math.sqrt(dx * dx + dy * dy)
    let angle = (Math.asin(dy / radius) / Math.PI) * 180
    if (dx < 0) {
      angle = 180 - angle
    }
    let color = Hct.from(angle, radius * 90, 100 - radius * 50).toInt()
    data.data[val + 0] = redFromArgb(color) // red
    data.data[val + 1] = greenFromArgb(color) // green
    data.data[val + 2] = blueFromArgb(color) // blue
    data.data[val + 3] = 255 // alpha
  }
  ctx.putImageData(data, 0, 0)
  const preview = document.getElementById("selector") as HTMLElement
  type PosAnim = Vec2
  type Anim = { pos: PosAnim; scale: { value: number } }
  const posAnim = createAnimation<PosAnim>(
    newVec2(width / 2, height / 2),
    getSlerp(0.05)
  )
  const scaleAnim = createAnimation({ value: 1 }, getSlerp(0.2))
  const anim = createParentAnimation<Anim>(
    { pos: posAnim, scale: scaleAnim },
    NO_INTERP
  )
  const updateLayer = getUpdateLayer<Anim>()
  const momentumLayer = localMomentumLayer(0.08, 1)
  const snapLayer = getSnapPointLayer(
    { x: width / 2, y: height / 2 },
    distanceLessThan(8)
  )
  snapLayer.mount(posAnim)
  updateLayer.subscribe("update", anim => {
    const {
      pos: { x, y },
      scale: { value: scale },
    } = getStateTree(anim)

    const { data: color } = ctx!.getImageData(x * DPR, y * DPR, 1, 1)
    preview.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    preview.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`
    // preview.style.left = x + "px"
    // preview.style.top = y + "px"
  })
  const restrictExtension = restrictFromFunctionExtension<PosAnim>(state => {
    const center = newVec2(width / 2, height / 2)
    const fromCenter = subVec(state, center)
    if (mag(fromCenter) > width / 2 - 8) {
      const fromTopLeft = addVec(
        mulScalar(
          normalize(fromCenter),
          width / 2 - 8 - Number.EPSILON * width
        ),
        center
      )
      const vel = momentumLayer.getVelocity()
      if (vel == 0) {
        modifyTo(posAnim, fromTopLeft, false)
        return
      }
      const start = getStateTree(posAnim)
      const end = fromTopLeft
      const fromEnd = subVec(start, end)
      const dist = mag(fromEnd)
      changeInterpFunction(posAnim, getSlerp(dist / vel))
      modifyTo(posAnim, fromTopLeft, false)
    }
  })
  updateLayer.mount(anim)
  momentumLayer.mount(posAnim)
  restrictExtension(posAnim)
  function doCursorMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    modifyTo(posAnim, { x, y })
    if (numberOfUpdates < 3) {
      momentumLayer.clearRecordedStates()
      numberOfUpdates++
    }
  }
  let numberOfUpdates = 0
  canvas.addEventListener("pointerdown", function (e) {
    modifyTo(scaleAnim, { value: 1.2 })
    if (e.pointerType !== "mouse") {
    }
    canvas.style.cursor = "none"
    numberOfUpdates = 0
    preview.style.visibility = "visible"
    doCursorMove(e as PointerEvent)
    window.addEventListener("pointermove", doCursorMove)
    window.addEventListener(
      "pointerup",
      function () {
        if (numberOfUpdates > 2) {
          momentumLayer.startGlide()
        }
        modifyTo(scaleAnim, { value: 1 })
        canvas.style.cursor = "default"
        window.removeEventListener("pointermove", doCursorMove)
      },
      { once: true }
    )
  })
}
