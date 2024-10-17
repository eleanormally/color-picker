import HCTLib from "./shaderLib.js"

const TestFrag = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_pixel;
uniform float u_zAxis;
out vec4 fragColor;
${HCTLib}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy * vec2(2.0, 2.0)) - vec2(1.0, 1.0);
    float rad = sqrt((uv.x*uv.x)+(uv.y*uv.y));
    float angle = asin(uv.y/rad)/PI*180.0;
    if (uv.x < 0.0) {
      angle = 180.0 - angle;
    }
    if (distance(gl_FragCoord.xy, u_pixel) < 5.0) {
      fragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
    fragColor = hct(angle, rad*100.0, u_zAxis*100.0);
}`

const HCTCart = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_zAxis;
out vec4 fragColor;
${HCTLib}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution.xy ) ;
  fragColor = hct(uv.x*360.0, uv.y*100.0, u_zAxis*100.0);
}`

const HCTPolar = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_zAxis;
out vec4 fragColor;
${HCTLib}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy * vec2(2.0, 2.0)) - vec2(1.0, 1.0);
    float rad = sqrt((uv.x*uv.x)+(uv.y*uv.y));
    float angle = asin(uv.y/rad)/PI*180.0;
    if (uv.x < 0.0) {
      angle = 180.0 - angle;
    }
    fragColor = hct(angle, rad*100.0, u_zAxis*100.0);
}`
const HCTNoZ = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_zAxis;
out vec4 fragColor;
${HCTLib}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy * vec2(2.0, 2.0)) - vec2(1.0, 1.0);
    float rad = sqrt((uv.x*uv.x)+(uv.y*uv.y));
    float angle = asin(uv.y/rad)/PI*180.0;
    if (uv.x < 0.0) {
      angle = 180.0 - angle;
    }
    fragColor = hct(angle, rad*100.0, 100.0-(rad*100.0));
}`

const VerticalGreyscaleGradient = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_zAxis;
out vec4 fragColor;
${HCTLib}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy * vec2(2.0, 2.0)) - vec2(1.0, 1.0);
    fragColor = hct(u_hue, u_chroma, (clamp((uv.y*1.1), -1.0, 1.0)+1.0)*50.0);
}
`

export {
  TestFrag,
  HCTCart,
  HCTPolar,
  HCTNoZ,
  VerticalGreyscaleGradient
}

