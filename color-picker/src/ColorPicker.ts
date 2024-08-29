import { addReactor, distanceLessThan, getSnapPointLayer, getUpdateLayer, localMomentumLayer, restrictFromFunctionExtension } from '@aninest/extensions';
import { blueFromArgb, greenFromArgb, Hct, redFromArgb } from '@material/material-color-utilities';
import { addLocalListener, addVec, changeInterpFunction, createAnimation, createParentAnimation, getInterpFunction, getSlerp, getStateTree, mag, modifyTo, mulScalar, newVec2, NO_INTERP, normalize, subVec, Vec2 } from 'aninest';
import { html, css, LitElement } from 'lit';

function getColor(x: number, y: number): [number, number, number, number] {
  let radius = Math.sqrt(x * x + y * y)
  let angle = (Math.asin(y / radius) / Math.PI) * 180
  if (x < 0) {
    angle = 180 - angle
  }
  let color = Hct.from(angle, radius * 90, 100 - radius * 50).toInt()
  return [
    redFromArgb(color),
    greenFromArgb(color),
    blueFromArgb(color),
    255,
  ]
}

type PosAnim = Vec2
type Anim = {
  pos: PosAnim
  scale: { value: number }
  borderColorPos: PosAnim
}

export class ColorPicker extends LitElement {

  drawFunction: ((x: number, y: number) => [number, number, number, number]) | null
  lodOptions: number[]
  lodSelected: number
  private imageData: Map<number, ImageData> | null

  static styles = css`
      #bound {
        position: relative;
        border-radius: 9999px;
        width: 100%;
        height: 100%;
      }
      #center {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

      }
      #selector {
        position: absolute;
        height: 1rem;
        width: 1rem;
        border: solid;
        border-width: 3px;
        box-sizing: border-box;
        border-radius: 4rem;
        pointer-events: none;
        visibility: hidden;
        border-color: white;
        z-index: 10;
      }
      #border {
        border-radius: 9999px;
        --tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);
        box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
        border: solid;
        border-color: white;
        --tw-pinch-zoom: pinch-zoom;
        touch-action: var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom);
        border-width: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2;
        background-color: white;
      }
      #canvas {
        border-radius: 9999px;
        --tw-border-opacity: 1;
        --tw-pinch-zoom: pinch-zoom;
        touch-action: var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom);
        z-index: 1;
      }
  `

  constructor() {
    super()
    this.drawFunction = null
    this.lodOptions = [1, 2, 4, 32]
    this.lodSelected = 1
    this.imageData = null
  }

  render() {
    return html`
      <div id="bound">
          <div id="selector"></div>
          <div id="center">
            <div id="border">
              <canvas id="canvas"></canvas>
            </div>
          </div>
      </div>
    `
  }

  redrawCanvas() {
    const canvas = this.shadowRoot!.getElementById("canvas") as HTMLCanvasElement
    const ctx = canvas.getContext("2d")
    if (ctx === null) {
      return
    }

    if (this.imageData === null) {
      this.imageData = new Map();
      for (let i = 0; i < this.lodOptions.length; i++) {
        this.imageData.set(this.lodOptions[i], ctx.createImageData(Math.ceil(canvas.width / this.lodOptions[i]), canvas.height / this.lodOptions[i]))
      }
    }
    let id = this.imageData.get(this.lodSelected)
    if (id === undefined) {
      alert("unsuported level of detail")
      return
    }
    if (this.drawFunction === null) {
      return
    }

    for (let val = 0; val < id.data.length; val += 4) {
      let i = val / 4
      let y = Math.floor(i * this.lodSelected / canvas.width)
      let x = (i * this.lodSelected) % canvas.width
      let dx = (x / canvas.width) * 2 - 1
      let dy = (y / canvas.height) * 2 - 1
      const rgba = this.drawFunction(dx, dy)
      id.data[val + 0] = rgba[0]
      id.data[val + 1] = rgba[1]
      id.data[val + 2] = rgba[2]
      id.data[val + 3] = rgba[3]
    }

    ctx.putImageData(id, 0, 0)
  }

  initializeAnimations(canvas: HTMLCanvasElement, width: number, height: number) {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    const selector = this.shadowRoot!.getElementById("selector") as HTMLElement
    const border = this.shadowRoot!.getElementById("border") as HTMLElement

    const posAnim = createAnimation<PosAnim>(
      newVec2(width / 2, height / 2),
      getSlerp(0.05)
    )
    const borderColorAnim = createAnimation<PosAnim>(
      newVec2(width / 2, height / 2),
      NO_INTERP
    )
    const scaleAnim = createAnimation({ value: 1 }, getSlerp(0.1))
    const anim = createParentAnimation<Anim>(
      { pos: posAnim, scale: scaleAnim, borderColorPos: borderColorAnim },
      NO_INTERP
    )

    const updateLayer = getUpdateLayer<Anim>()
    const momentumLayer = localMomentumLayer(0.08, 1)
    const snapLayer = getSnapPointLayer(
      { x: width / 2, y: height / 2 },
      distanceLessThan(8)
    )
    snapLayer.mount(posAnim)
    addReactor(anim, ({ pos }) => ({ borderColorPos: pos }), {
      borderColorPos: false,
      scale: false,
    })

    updateLayer.subscribe("update", anim => {
      const {
        pos: { x, y },
        scale: { value: scale },
        borderColorPos: { x: borderX, y: borderY },
      } = getStateTree(anim)

      const { data: color } = ctx.getImageData(x * window.devicePixelRatio, y * window.devicePixelRatio, 1, 1)
      const { data: borderColor } = ctx.getImageData(
        borderX * window.devicePixelRatio,
        borderY * window.devicePixelRatio,
        1,
        1,
      )
      selector.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
      selector.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`
      border.style.borderColor = `rgb(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]})`

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
    // addLocalListener(posAnim, "start", () => {
    //   const posInterp = getInterpFunction(posAnim)
    //   if (posInterp(0.2) === undefined) {
    //     changeInterpFunction(borderColorPos, NO_INTERP)
    //     // set border color here!
    //   } else {
    //     changeInterpFunction(borderColorPos, posInterp)
    //   }
    // })
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
    canvas.addEventListener("pointerdown", function(e) {
      modifyTo(scaleAnim, { value: 1.2 })
      if (e.pointerType !== "mouse") {
      }
      // canvas.style.cursor = "none"
      numberOfUpdates = 0
      selector.style.visibility = "visible"
      doCursorMove(e as PointerEvent)
      window.addEventListener("pointermove", doCursorMove)
      window.addEventListener(
        "pointerup",
        function() {
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

  updated() {
    const canvas = this.shadowRoot!.getElementById('canvas')! as HTMLCanvasElement
    const bound = this.shadowRoot!.getElementById('bound')! as HTMLCanvasElement
    if (canvas.width > canvas.height) {
      canvas.width = canvas.height
      bound.style.width = bound.style.height
    } else {
      canvas.height = canvas.width
      bound.style.height = bound.style.width
    }
    const DPR = window.devicePixelRatio
    const width = canvas.width
    const height = canvas.height
    canvas.width *= DPR
    canvas.height *= DPR
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    this.redrawCanvas()
    this.initializeAnimations(canvas, width, height)
  }
}
