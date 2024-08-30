import './style.css'

const canvas = document.getElementById("canvas") as HTMLCanvasElement
canvas.style.width = `${canvas.width}px`;
canvas.style.height = `${canvas.height}px`;
canvas.width = 8000
canvas.height = 8000

function pushFragShaderToCanvas(fragmentShaderCode: string) {
  const canvas = document.getElementById("canvas")! as HTMLCanvasElement
  const gl = canvas.getContext('webgl2')
  if (gl === null) {
    alert("WebGL2 not supported")
    return
  }
  const vertexShaderCode = `#version 300 es
    in vec4 vertexPosition;

    void main() {
      gl_Position = vertexPosition;
    }
  `;
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vertexShader, vertexShaderCode.trim())
  gl.compileShader(vertexShader)
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    alert(`unable to compile vertex shader: ${gl.getShaderInfoLog(vertexShader)}`)
    return
  }
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fragmentShader, fragmentShaderCode.trim())
  gl.compileShader(fragmentShader)
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    alert(`unable to compile fragment shader: ${gl.getShaderInfoLog(fragmentShader)}`)
    return
  }

  const program = gl.createProgram();
  if (program === null) {
    alert("could not create program")
    return
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    alert(`Could not link shader program: ${gl.getProgramInfoLog(program)}`)
    return
  }
  gl.useProgram(program)

  const vertices = [
    [-1, -1, 0], // [x, y, z]
    [1, -1, 0],
    [1, 1, 0],
    [1, 1, 0],
    [-1, 1, 0],
    [-1, -1, 0],
  ];
  const vertexData = new Float32Array(vertices.flat())
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW)
  const vertexPosition = gl.getAttribLocation(program, "vertexPosition")
  gl.enableVertexAttribArray(vertexPosition)
  gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0)

  const resolutionUniform = gl.getUniformLocation(program, 'u_resolution')
  gl.uniform2fv(resolutionUniform, [canvas.width, canvas.height])
  const zAxisUniform = gl.getUniformLocation(program, 'u_zAxis')

  gl.drawArrays(gl.TRIANGLES, 0, vertices.length)
  const rect = canvas.getBoundingClientRect()
  canvas.addEventListener("mousemove", (e) => {
    const mousePos = (e.clientY - rect.top) / rect.height
    gl.uniform1f(zAxisUniform, mousePos)
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length)
  })
}

fetch("/hct.frag").then((response) => {
  response.text().then((shader) => {
    pushFragShaderToCanvas(shader)
  })
})
