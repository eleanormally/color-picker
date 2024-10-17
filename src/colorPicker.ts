import { addReactor, getInterpingToProxy, getUpdateLayer, restrictFromFunctionExtension } from '@aninest/extensions';
import {
  createAnimation,
  createParentAnimation,
  getSlerp,
  getStateTree,
  modifyTo,
  NO_INTERP,
  Animation,
  UnknownRecursiveAnimatable,
  PartialRecursiveAnimatable,
  ExtensionStack,
  getLocalInterpingToValue,
  getInterpingToTree,
} from 'aninest';
import { html, css, LitElement } from 'lit';

const squareVertexShader = `#version 300 es
  in vec4 vertexPosition;

  void main() {
    gl_Position = vertexPosition;
  }
`

type FullAnim<T extends UnknownRecursiveAnimatable> = {
  pos: {
    x: number,
    y: number,
  },
  scale: {
    value: number,
  },
  generic: T,

}

// NOTE: During animation, the path of generic and the path of cartesian will linearly
//       animate their components. On stop they will reach the same point, but the 
//       intermediate points will not necessarily align.
//       Color does animate according to cartesian coordinates.
export class PickerBase<T extends UnknownRecursiveAnimatable> extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
      }
      #selector {
        position: absolute;
        pointer-events: none;
        z-index: 10;
      }
      #bound {
        height: 100%;
        width: 100%;
        z-index: 3;
      }
      #canvas {
        height: 100%;
        position: relative;
        width: 100%;
        touch-action: none;
        user-select: none;
        z-index: 1;
      }
    `
  ]

  render() {
    return html`
        <div id="bound">
          <div id="selector"></div>
          <canvas id="canvas"></canvas>
        </div>
    `
  }

  encodeFromCanvasPosition(canvas: HTMLCanvasElement, pos: { x: number, y: number }): T {
    return {} as T
  }
  encodeToCanvasRelativePosition(canvas: HTMLCanvasElement, data: T): { x: number, y: number } {
    return {} as { x: number, y: number }
  }

  private gl: WebGLRenderingContext | undefined
  private program: WebGLProgram | undefined

  private initialShader?: string

  protected currentLocation: T

  private zAxis?: number


  protected extensions: ExtensionStack<T>

  constructor() {
    super()
    this.extensions = []
    this.currentLocation = {} as T
  }

  updated() {
    if (this.initialShader !== undefined) {
      const result = this.setShader(this.initialShader)
      if (result !== null) {
        console.log("error setting shader: " + result)
      }
    }
    if (this.zAxis !== undefined) {
      this.setZAxis(this.zAxis)
    }
    this.initializeAnimations()
  }

  private initializeAnimations() {
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    const selector = this.renderRoot.querySelector("#selector") as HTMLElement
    const { width, height } = canvas.getBoundingClientRect()
    const root = this.renderRoot.children.item(0) as HTMLElement
    selector.style.transform = `translate(calc(${(width / 2)}px - 50%), calc(${(height / 2)}px - 50%))`

    const cartesianAnim = createAnimation(this.encodeToCanvasRelativePosition(canvas, this.currentLocation), getSlerp(0.1))

    const scaleAnim = createAnimation(
      { value: 1.0 },
      getSlerp(0.1)
    )

    const genericAnim = createAnimation(this.currentLocation, NO_INTERP)

    const fullAnimation = createParentAnimation<FullAnim<T>>(
      {
        pos: cartesianAnim,
        scale: scaleAnim,
        generic: genericAnim as any,
      },
      NO_INTERP
    )

    const genericUpdateLayer = getUpdateLayer<T>()
    const updateLayer = getUpdateLayer<FullAnim<T>>()

    const proxy = getInterpingToProxy(cartesianAnim)

    addReactor(fullAnimation, (anim) => {
      const state = getInterpingToTree(fullAnimation) //TODO: fix getInterpingToProxy to allow for anim input to be used
      console.log(state.pos, anim.pos, proxy, getLocalInterpingToValue(cartesianAnim, "x"))
      return {
        generic: this.encodeFromCanvasPosition(canvas, state.pos),
      } as PartialRecursiveAnimatable<T>
    },
      { generic: false, scale: false },
    )


    const encodeToCanvas = this.encodeToCanvasRelativePosition
    genericUpdateLayer.subscribe("update", anim => {
      const state = getStateTree(anim)
      modifyTo(
        cartesianAnim,
        encodeToCanvas(canvas, state),
        true
      )
    })


    updateLayer.subscribe("update", anim => {
      const state = getStateTree(anim)
      selector.style.transform = `translate(calc(${state.pos.x}px - 50%), calc(${state.pos.y}px - 50%)) scale(${state.scale.value})`
      const color = this.getColorAtCanvasPixel(state.pos.x, state.pos.y)

      root.style.setProperty('--selected-color', `rgb(${color.r}, ${color.g}, ${color.b})`)
      this.currentLocation = state.generic
      const event = new CustomEvent(
        'posupdate',
        {
          bubbles: true,
          composed: true,
          detail: {
            pos: state.generic,
            color: color,
            pixels: state.pos,
          }
        })
      this.dispatchEvent(event)
    })
    updateLayer.mount(fullAnimation)

    this.extensions.forEach((extension) => {
      extension(genericAnim)
    })

    function doCursorMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect()
      const val = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      modifyTo(cartesianAnim, val)
    }

    canvas.addEventListener("pointerdown", function(e) {
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

  private getColorAtCanvasPixel(x: number, y: number): { r: number, b: number, g: number } {
    let pixel = new Uint8Array(4)
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    const cRect = canvas.getBoundingClientRect()
    this.gl?.readPixels(x / cRect.width * canvas.width, (1 - y / cRect.height) * canvas.height, 1, 1, this.gl?.RGBA, this.gl?.UNSIGNED_BYTE, pixel)
    return {
      r: pixel[0],
      g: pixel[1],
      b: pixel[2]
    }
  }


  private initializeShader(shaderType: number, shaderCode: string): WebGLShader | string {
    const shader = this.gl?.createShader(shaderType) ?? null
    if (shader === null) {
      return "unable to create shader"
    }
    this.gl?.shaderSource(shader, shaderCode.trim())
    this.gl?.compileShader(shader)
    if (!this.gl?.getShaderParameter(shader, this.gl?.COMPILE_STATUS)) {
      return this.gl?.getShaderInfoLog(shader) ?? ""
    }
    return shader
  }
  setShader(shader: string): string | null {
    const canvas = this.renderRoot.querySelector('#canvas')! as HTMLCanvasElement
    this.initialShader = shader
    if (canvas === null) {
      return null
    }
    this.gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ?? undefined
    if (this.gl === undefined) {
      return "unable to initialize webgl"
    }
    const vertexShader = this.initializeShader(this.gl.VERTEX_SHADER, squareVertexShader)
    if (typeof vertexShader === "string") {
      return "error loading vertex shader: " + vertexShader
    }
    const fragmentShader = this.initializeShader(this.gl.FRAGMENT_SHADER, shader)
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
    const root = this.renderRoot.children.item(0) as HTMLElement
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    this.zAxis = z
    if (this.gl === undefined || this.program === undefined) {
      return
    }
    const zUniform = this.gl.getUniformLocation(this.program, 'u_zAxis')
    this.gl.uniform1f(zUniform, z)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    const pos = this.encodeToCanvasRelativePosition(canvas, this.currentLocation)
    const color = this.getColorAtCanvasPixel(pos.x, pos.y)

    root.style.setProperty('--selected-color', `rgb(${color.r}, ${color.g}, ${color.b})`)
  }

}

