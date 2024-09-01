import { getUpdateLayer, restrictFromFunctionExtension } from "@aninest/extensions"
import { createAnimation, createParentAnimation, getSlerp, getStateTree, modifyTo, NO_INTERP } from "aninest"
import { css, html, LitElement } from "lit"

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

type ScalarAnim = { value: number }
type Anim = {
  pos: ScalarAnim,
  scale: ScalarAnim
}

export class VerticalSlider extends LitElement {
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
      width: 2rem;
      height: 100%;
    }
    #selector {
      position: absolute;
      height: 20px;
      width: 20px;
      background-color: white;
      border: solid;
      border-width: 3px;
      box-sizing: border-box;
      border-radius: 4rem;
      pointer-events: none;
      border-color: white;
      z-index: 10;
    }
    #canvas {
      --tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);
      box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
      border-radius: 9999px;
      height: 100%;
      width: 100%;
      border: none;
      border: solid;
      background-color: black;
      border-color: white;
      border-width: 8px;
      --tw-pinch-zoom: pinch-zoom;
      touch-action: var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom);
      z-index: 1;
    }
    
  `

  render() {
    return html`
      <div id="bound">
        <div id="selector"></div>
          <canvas id="canvas"></canvas>
      </div>
    `
  }

  initializeAnimations() {
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLElement
    const selector = this.renderRoot.querySelector("#selector") as HTMLElement
    const { width, height, left, top } = canvas.getBoundingClientRect()
    selector.style.transform = `translate(calc(${width / 2}px - 50%), calc(${height / 2}px - 50%))`

    const posAnim = createAnimation<ScalarAnim>(
      { value: 0.0 },
      getSlerp(0.02)
    )

    const restrictPosition = restrictFromFunctionExtension<ScalarAnim>(state => {
      if (state.value > height - 28) {
        modifyTo(posAnim, { value: height - 28 }, true)
      }
      else if (state.value < 28) {
        modifyTo(posAnim, { value: 28 }, true)
      }
    })
    restrictPosition(posAnim)

    const scaleAnim = createAnimation<ScalarAnim>(
      { value: 1.0 },
      getSlerp(0.1)
    )

    const anim = createParentAnimation<Anim>({
      pos: posAnim,
      scale: scaleAnim
    }, NO_INTERP)

    let pixel = new Uint8Array(4)
    const updateLayer = getUpdateLayer<Anim>()
    updateLayer.subscribe("update", anim => {
      const state = getStateTree(anim)
      this.gl?.readPixels(width / 2 * window.devicePixelRatio, (height - state.pos.value - 10), 1, 1, this.gl?.RGBA, this.gl?.UNSIGNED_BYTE, pixel)
      selector.style.transform = `translate(calc(${width / 2}px - 50%), calc(${state.pos.value}px - 50%)) scale(${state.scale.value})`
      this.dispatchEvent(new CustomEvent("valueupdate", {
        detail: {
          value: 1 - (state.pos.value - 28) / (height - 56)
        },
        bubbles: true,
      }))
    })
    updateLayer.mount(anim)

    function doCursorMove(e: PointerEvent) {
      const value = e.clientY - top
      modifyTo(posAnim, { value })
    }

    canvas.addEventListener("pointerdown", function(e) {
      doCursorMove(e)
      modifyTo(scaleAnim, { value: 1.2 })
      window.addEventListener("pointermove", doCursorMove)
      window.addEventListener("pointerup", function() {
        window.removeEventListener("pointermove", doCursorMove)
        modifyTo(scaleAnim, { value: 1.0 })
      }, { once: true })
    })


  }

  firstUpdated() {
    if (this.fragShader !== undefined) {
      this.setShader(this.fragShader)
    }
    this.initializeAnimations()
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

  getGlContext(): WebGLRenderingContext | undefined {
    return this.gl
  }

  getProgram(): WebGLProgram | undefined {
    return this.program
  }

}
