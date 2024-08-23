import initPicker from "./initPicker"
import "./style.css"

const html = (a: any) => a

document.querySelector<HTMLDivElement>("#app")!.innerHTML = html`
  <div class="flex justify-center items-center h-full">
    <div class="flex justify-center items-center h-full">
      <div class="relative">
        <div
          class="absolute h-4 w-4 border-2 box-border rounded-full pointer-events-none invisible border-white"
          id="selector"
        ></div>
        <canvas
          id="picker-canvas"
          class="rounded-full border-white touch-pinch-zoom border-8 shadow-md"
        ></canvas>
      </div>
    </div>
  </div>
`

initPicker()
