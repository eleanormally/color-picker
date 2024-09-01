import { addReactor, distanceLessThan, getSnapPointLayer, getUpdateLayer, localMomentumLayer, restrictFromFunctionExtension } from '@aninest/extensions';
import { addLocalListener, addVec, changeInterpFunction, createAnimation, createParentAnimation, getInterpFunction, getSlerp, getStateTree, mag, modifyTo, mulScalar, newVec2, NO_INTERP, normalize, subVec, Vec2 } from 'aninest';
import { html, css, LitElement } from 'lit';

type PosAnim = Vec2
type Anim = {
  pos: PosAnim
  scale: { value: number }
  borderColorPos: PosAnim
}

const squareVertexShader = `#version 300 es
  in vec4 vertexPosition;

  void main() {
    gl_Position = vertexPosition;
  }
`

function initializeShader(gl: WebGLRenderingContext, shaderType: number, shaderCode: String): WebGLShader | string {
  const shader = gl.createShader(shaderType)
  if (shader === null) {
    return "unable to create shader"
  }
  gl.shaderSource(shader, shaderCode.trim())
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return gl.getShaderInfoLog(shader) ?? ""
  }
  return shader
}

export class ColorPicker extends LitElement {

  fragShader?: String
  gl?: WebGLRenderingContext
  program?: WebGLProgram

  static styles = css`
      :host {
        display: block;
      }
      #bound {
        position: relative;
        border-radius: 9999px;
        width: 100%;
        height: 100%;
      }
      #selector {
        position: absolute;
        height: 2rem;
        width: 2rem;
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
        border-width: 8px;
        height: 100%;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2;
        background-color: white;
      }
      #canvas {
        border-radius: 9999px;
        height: 100%;
        width: 100%;
        border: solid;
        border-color: white;
        border-width: 8px;
        // --tw-border-opacity: 1;
        --tw-pinch-zoom: pinch-zoom;
        touch-action: var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom);
        z-index: 1;
      }
  `

  constructor() {
    super()
  }


  render() {
    return html`
      <div id="bound">
          <div id="selector"></div>
          <div id="border">
            <canvas id="canvas"></canvas>
          </div>
      </div>
    `
  }


  initializeAnimations(canvas: HTMLCanvasElement, width: number, height: number) {
    const selector = this.renderRoot.querySelector("#selector") as HTMLElement
    const border = this.renderRoot.querySelector("#border") as HTMLElement

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
    const momentumLayer = localMomentumLayer(0.8, 1)
    const snapLayer = getSnapPointLayer(
      { x: width / 2 + 16, y: height / 2 + 16 },
      distanceLessThan(width / 32)
    )
    snapLayer.mount(posAnim)
    addReactor(anim, ({ pos }) => ({ borderColorPos: pos }), {
      borderColorPos: false,
      scale: false,
    })

    const colorValue: {
      pixel: Uint8Array,
      position: [number, number]
    } = {
      pixel: new Uint8Array(4),
      position: [Infinity, Infinity]
    }

    updateLayer.subscribe("update", anim => {
      const {
        pos: { x, y },
        scale: { value: scale },
      } = getStateTree(anim)

      if (colorValue.position[0] !== x || colorValue.position[1] !== y) {
        this.gl?.readPixels(Math.floor((x - 16) * window.devicePixelRatio), Math.floor((height - (y - 16)) * window.devicePixelRatio), 1, 1, this.gl?.RGBA, this.gl?.UNSIGNED_BYTE, colorValue.pixel)
        colorValue.position = [x, y]
      }
      selector.style.backgroundColor = `rgb(${colorValue.pixel[0]}, ${colorValue.pixel[1]}, ${colorValue.pixel[2]})`
      selector.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`
      border.style.borderColor = `rgb(${colorValue.pixel[0]}, ${colorValue.pixel[1]}, ${colorValue.pixel[2]})`

    })

    const restrictExtension = restrictFromFunctionExtension<PosAnim>(state => {
      const center = newVec2(width / 2 + 16, height / 2 + 16)
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
    canvas.addEventListener("pointerdown", function(e) {
      modifyTo(scaleAnim, { value: 1.2 })
      if (e.pointerType !== "mouse") {
      }
      canvas.style.cursor = "none"
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

  firstUpdated() {
    this.doResize()
    //TODO: figure out a better way than this bouncing, since it doesn't return errors
    if (this.fragShader != undefined) {
      this.setShader(this.fragShader)
    }
    this.renderRoot.addEventListener('onresize', () => {
      console.log("resize")
      this.doResize()
    })
  }

  doResize() {
    const canvas = this.renderRoot.querySelector('#canvas')! as HTMLCanvasElement
    const border = this.renderRoot.querySelector('#border')! as HTMLCanvasElement
    const borderRect = border.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    if (borderRect.width < borderRect.height) {
      canvas.width = canvasRect.width
      canvas.height = canvasRect.width
      canvas.style.width = `${canvasRect.width}px`;
      canvas.style.height = `${canvasRect.width}px`;
      border.style.width = `${borderRect.width}px`;
      border.style.height = `${borderRect.width}px`;
    } else {
      canvas.width = canvasRect.height
      canvas.height = canvasRect.height
      canvas.style.width = `${canvasRect.height}px`;
      canvas.style.height = `${canvasRect.height}px`;
      border.style.width = `${borderRect.height}px`;
      border.style.height = `${borderRect.height}px`;
    }
    const DPR = window.devicePixelRatio
    const width = canvas.width
    const height = canvas.height
    canvas.width *= DPR
    canvas.height *= DPR
    this.initializeAnimations(canvas, width, height)
  }


  setShader(shader: String): string | null {
    //checking if the component hasn't been mounted yet during call. this should probably be some event hold
    this.fragShader = shader
    const canvas = this.renderRoot.querySelector('#canvas')! as HTMLCanvasElement
    if (canvas === null) {
      return null
    }
    this.fragShader = undefined
    this.gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ?? undefined
    if (this.gl === undefined) {
      return "unable to initialize webgl"
    }
    const vertexShader = initializeShader(this.gl, this.gl.VERTEX_SHADER, squareVertexShader)
    if (typeof vertexShader === "string") {
      return "error loading vertex shader: " + vertexShader
    }
    const fragmentShader = initializeShader(this.gl, this.gl.FRAGMENT_SHADER, shader)
    if (typeof fragmentShader === "string") {
      return "error loading given fragment shader: " + fragmentShader
    }
    const program = this.gl.createProgram();
    if (program === null) {
      return "could not create shader program"
    }
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      return "could not link shader program: " + this.gl.getProgramInfoLog(program)
    }
    this.gl.useProgram(program)
    this.program = program

    const vertices = [
      [-1, -1, 0], // [x, y, z]
      [1, -1, 0],
      [1, 1, 0],
      [1, 1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
    ];
    const vertexData = new Float32Array(vertices.flat())
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer())
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW)
    const vertexPosition = this.gl.getAttribLocation(program, "vertexPosition")
    this.gl.enableVertexAttribArray(vertexPosition)
    this.gl.vertexAttribPointer(vertexPosition, 3, this.gl.FLOAT, false, 0, 0)

    const resolutionUniform = this.gl.getUniformLocation(program, 'u_resolution')
    this.gl.uniform2fv(resolutionUniform, [canvas.width, canvas.height])
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    return null
  }

  setZAxis(z: number) {
    if (this.gl === undefined || this.program === undefined) {
      return
    }
    const zUniform = this.gl.getUniformLocation(this.program, 'u_zAxis')
    this.gl.uniform1f(zUniform, z)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

}
