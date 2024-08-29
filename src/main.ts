import "./style.css"

const html = (a: any) => a

document.querySelector<HTMLDivElement>("#app")!.innerHTML = html`
  <div class="flex justify-center items-center h-full">
    <div class="flex justify-center items-center h-full">
      <color-picker></color-picker>
    </div>
  </div>
`
