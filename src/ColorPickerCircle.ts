import { css, html } from "lit"
import { PickerBase } from "./ColorPicker.js"
import { restrictFromFunctionExtension } from "@aninest/extensions"

type PolarPos = { r: number, theta: number }

class CirclePicker extends PickerBase<PolarPos> {
  static styles = [
    ...super.styles,
    css`
      #selector {
        background-color: var(--selected-color);
        width: 2rem;
        height: 2rem;
        border-radius: 9999px;
        border: solid;
        border-width: 4px;
        border-color: white;
      }
      #color-border {
        border-radius: 9999px;
        border: solid;
        border-width: 5px;
        border-color: var(--selected-color);
        overflow: hidden;
      }
      #white-border {
        border-radius: 9999px;
        border: solid;
        border-width: 5px;
        border-color: white;
        overflow: hidden;
      }
  `
  ]

  render() {
    return html`
      <div id="color-border">
        <div id="white-border">
          ${super.render()}
        </div>
      </div>
    `
  }

  constructor() {
    super()
    this.currentLocation = { r: 0, theta: 0 }
    this.extensions = [
      restrictFromFunctionExtension<PolarPos>(state => {
        console.log(state)
        if (state.r > 1) {
          state.r = 1
        }
      })
    ]
  }

  updated() {
    const bound = this.renderRoot.querySelector("#bound") as HTMLElement
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    const rect = bound.getBoundingClientRect()
    const cRect = canvas.getBoundingClientRect()
    if (rect.width < rect.height) {
      bound.style.width = `${rect.width}px`;
      bound.style.height = `${rect.width}px`;
      canvas.height = cRect.width
      canvas.width = cRect.width
    } else {
      bound.style.width = `${rect.height}px`;
      bound.style.height = `${rect.height}px`;
      canvas.width = cRect.height
      canvas.height = cRect.height
    }

    super.updated()
  }

  encodeToCanvasRelativePosition(canvas: HTMLCanvasElement, data: PolarPos): { x: number, y: number } {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (rect.width + Math.cos(data.theta) * data.r * rect.width) / 2,
      y: (rect.height - Math.sin(data.theta) * data.r * rect.height) / 2,
    }
  }

  encodeFromCanvasPosition(canvas: HTMLCanvasElement, pos: { x: number, y: number }): PolarPos {
    const rect = canvas.getBoundingClientRect()
    const uvX = (((pos.x) / rect.width) - 0.5) * 2
    const uvY = (0.5 - ((pos.y) / rect.height)) * 2
    const rad = Math.sqrt(uvX * uvX + uvY * uvY)
    let angle = Math.asin(uvY / rad)
    if (uvX < 0) {
      angle = Math.PI - angle
    }
    angle = ((2 * Math.PI) + angle) % (2 * Math.PI)
    return {
      r: rad,
      theta: angle
    }
  }

}

export default CirclePicker

