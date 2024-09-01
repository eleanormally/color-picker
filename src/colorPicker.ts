import { addReactor, distanceLessThan, getSnapPointLayer, getUpdateLayer, localMomentumLayer, restrictFromFunctionExtension } from '@aninest/extensions';
import { addLocalListener, addVec, changeInterpFunction, createAnimation, createParentAnimation, getInterpFunction, getSlerp, getStateTree, mag, modifyTo, mulScalar, newVec2, NO_INTERP, normalize, subVec, Vec2 } from 'aninest';
import { html, css, LitElement } from 'lit';

type PosAnim = Vec2
type Anim = {
  pos: PosAnim
  scale: { value: number }
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
  zAxis: number

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
        background-color: white;
        width: 2rem;
        border: solid;
        border-width: 3px;
        box-sizing: border-box;
        border-radius: 4rem;
        pointer-events: none;
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
    this.zAxis = 0
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


  initializeAnimations() {
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    const selector = this.renderRoot.querySelector("#selector") as HTMLElement
    const { width, height, left, top } = canvas.getBoundingClientRect()
    // const border = this.renderRoot.querySelector("#border") as HTMLElement

    selector.style.transform = `translate(calc(${(width / 2)}px - 50%), calc(${(height / 2)}px - 50%))`

    const posAnim = createAnimation<PosAnim>(
      newVec2(width / 2, height / 2),
      getSlerp(0.05)
    )

    const restrictPosition = restrictFromFunctionExtension<PosAnim>(state => {
      const center = newVec2(width / 2, height / 2)
      const dist = subVec(state, center)
      if (mag(dist) > width / 2 - 16) {
        const updatedDestination = addVec(mulScalar(normalize(dist), width / 2 - 16), center)
        modifyTo(posAnim, updatedDestination, true)
      }
    })
    restrictPosition(posAnim)

    const snapLayer = getSnapPointLayer(
      { x: width / 2, y: height / 2 },
      distanceLessThan(width / 32)
    )
    snapLayer.mount(posAnim)

    const scaleAnim = createAnimation<{ value: number }>(
      { value: 1.0 },
      getSlerp(0.1)
    )

    const fullAnimation = createParentAnimation<Anim>(
      {
        pos: posAnim,
        scale: scaleAnim,
      },
      NO_INTERP
    )

    const updateLayer = getUpdateLayer<Anim>()
    let pixel = new Uint8Array(4)
    updateLayer.subscribe("update", anim => {
      const state = getStateTree(anim)

      this.gl?.readPixels((state.pos.x - 14) * window.devicePixelRatio, (height - (state.pos.y + 14)) * window.devicePixelRatio, 1, 1, this.gl?.RGBA, this.gl?.UNSIGNED_BYTE, pixel)
      console.log(pixel)
      selector.style.backgroundColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`
      selector.style.transform = `translate(calc(${state.pos.x}px - 50%), calc(${state.pos.y}px - 50%)) scale(${state.scale.value})`
    })
    updateLayer.mount(fullAnimation)


    function doCursorMove(e: PointerEvent) {
      modifyTo(posAnim, { x: e.clientX - left, y: e.clientY - top })
    }

    canvas.addEventListener("pointerdown", function(e) {
      canvas.style.cursor = "none"
      modifyTo(scaleAnim, { value: 1.2 })
      doCursorMove(e)
      window.addEventListener("pointermove", doCursorMove)
      window.addEventListener("pointerup", function() {
        canvas.style.cursor = "default"
        window.removeEventListener("pointermove", doCursorMove)
        modifyTo(scaleAnim, { value: 1.0 })
      })
    })


  }

  firstUpdated() {
    this.doResize()
    //TODO: figure out a better way than this bouncing, since it doesn't return errors
    if (this.fragShader != undefined) {
      this.setShader(this.fragShader)
    }
    this.setZAxis(this.zAxis)
    this.renderRoot.addEventListener('onresize', () => {
      console.log("resize")
      this.doResize()
    })
    this.initializeAnimations()
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
    this.zAxis = z
    if (this.gl === undefined || this.program === undefined) {
      return
    }
    const zUniform = this.gl.getUniformLocation(this.program, 'u_zAxis')
    this.gl.uniform1f(zUniform, z)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  getGlContext(): WebGLRenderingContext | undefined {
    return this.gl
  }

}
