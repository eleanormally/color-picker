import { css, html } from "lit"
import { PickerBase } from "./ColorPicker.js"

type CartPos = { x: number, y: number }

class SquarePicker extends PickerBase<CartPos> {
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
      #border {
        border: solid;
        border-width: 5px;
        border-color: white;
      }
  `
  ]

  constructor() {
    super()
    this.currentLocation = { x: 0.5, y: 0.5 }
  }

  render() {
    return html`
      <div>
        <div id="border">
          ${super.render()}
        </div>
      </div>
    `
  }

  updated() {
    const bound = this.renderRoot.querySelector("#bound") as HTMLElement
    const canvas = this.renderRoot.querySelector("#canvas") as HTMLCanvasElement
    const rect = bound.getBoundingClientRect()
    const cRect = canvas.getBoundingClientRect()
    bound.style.width = `${rect.width}px`;
    bound.style.height = `${rect.height}px`;
    canvas.width = cRect.width
    canvas.height = cRect.height

    super.updated()
  }

  encodeToCanvasRelativePosition(canvas: HTMLCanvasElement, data: CartPos): { x: number, y: number } {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (rect.width * data.x),
      y: (rect.height * (1 - data.y)),
    }
  }

  encodeFromCanvasPosition(canvas: HTMLCanvasElement, pos: { x: number, y: number }): CartPos {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (pos.x) / rect.width,
      y: 1 - (pos.y) / rect.height,
    }
  }
}

export default SquarePicker
