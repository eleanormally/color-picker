import initPicker from './initPicker'
import './style.css'


document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="absolute h-4 w-4 border-2 rounded-full border-white" style="visibility:hidden; pointer-events: none" id="selector"></div>
<div class="flex justify-center items-center h-screen w-screen">
	<div id="picker-selector" class="absolute rounded-full border-white w-12 h-12 border-4 shadow-sm" style="display: none"></div>
	<div class="flex justify-center items-center">
		<canvas id="picker-canvas" class="rounded-full border-white border-8 shadow-md"></canvas>
  </div>
  </div>
`

initPicker()
