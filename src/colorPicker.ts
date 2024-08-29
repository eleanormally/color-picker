import { blueFromArgb, greenFromArgb, Hct, redFromArgb } from '@material/material-color-utilities';
import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('color-picker')
class ColorPicker extends LitElement {

  static styles = css`
      #bound {
        position: relative;
      }
      #selector {
        position: absolute;
        height: 4rem;
        width: 4rem;
        border-width: 2px;
        box-sizing: border-box;
        border-radius: 4rem;
        pointer-events: none;
        visibility: hidden;
        border-color: white;
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
      }
  `

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

  updated() {
    const canvas = this.shadowRoot!.getElementById('canvas')! as HTMLCanvasElement
    if (canvas.width > canvas.height) {
      canvas.width = canvas.height
    } else {
      canvas.height = canvas.width
    }
    const DPR = window.devicePixelRatio
    const width = canvas.width
    const height = canvas.height
    canvas.width *= DPR
    canvas.height *= DPR
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    if (ctx === null) {
      return
    }

    let id = ctx.createImageData(canvas.width, canvas.height)
    for (let val = 0; val < id.data.length; val += 4) {
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
      id.data[val + 0] = redFromArgb(color) // red
      id.data[val + 1] = greenFromArgb(color) // green
      id.data[val + 2] = blueFromArgb(color) // blue
      id.data[val + 3] = 255 // alpha
    }
    ctx.putImageData(id, 0, 0)

  }
}

export default ColorPicker
