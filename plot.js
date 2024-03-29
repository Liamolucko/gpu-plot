// TODO: dark mode, maybe?
const BACKGROUND_COLOR = [1.0, 1.0, 1.0];

// Grab the HTML elements we need.
/** @type {HTMLInputElement} */
const shaderTextField = document.getElementById("shader");
/** @type {HTMLInputElement} */
const thresholdSlider = document.getElementById("threshold-slider");

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("plot");
const errorLog = document.getElementById("error-log");

const gl = canvas.getContext("webgl2", {
  // Turn off these features that we aren't using.
  alpha: false,
  depth: false,
  antialias: false,
});

if (gl === null) {
  const err = new Error(
    "Your browser can't run this website, because it doesn't seem to support WebGL 2.",
  );
  alert(err);
  throw err;
}

function clear() {
  gl.clearColor(...BACKGROUND_COLOR, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

clear();

const vertexShader = gl.createShader(gl.VERTEX_SHADER);
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

/// Sets the source of `shader` to `src` and compiles it.
/// If `opts.alert` is true, errors will be displayed with `alert` as well as throwing.
function initShader(shader, src, opts) {
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const err = new Error(
      "Failed to compile shader:\n" + gl.getShaderInfoLog(shader),
    );
    if (opts.alert) {
      alert(err);
    }
    throw err;
  }
}

const vsSource = `\
    #version 300 es
    precision mediump float;

    void main() {
        gl_Position = vec4(-1.0, -1.0, 0.0, 1.0);

        if (gl_VertexID > 1) {
            gl_Position.y = 1.0;
        }

        if (gl_VertexID % 2 == 1) {
            gl_Position.x = 1.0;
        }
    }
`;

initShader(vertexShader, vsSource, { alert: true });

const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);

const fsHeader = `\
    #version 300 es
    precision mediump float;

    uniform float threshold;

    // Camera status
    uniform vec2 pos;
    uniform float scale;

    // The center of the screen in window space.
    uniform vec2 center;

    // Define some builtin functions for user shaders to use.
    bool close(float a, float b) {
        return abs(a - b) < threshold;
    }

    vec3 black_if(bool cond) {
        if (cond) {
            return vec3(0.0, 0.0, 0.0);
        } else {
            return vec3(1.0, 1.0, 1.0);
        }
    }
`;

const fsFooter = `
    layout(location = 0) out vec4 out_color;

    void main() {
        vec2 point = pos + scale * (gl_FragCoord.xy - center);
        out_color.xyz = color(point);
        out_color.w = 1.0;
    }
`;

function setupFragmentShader() {
  const fsSource = fsHeader + shaderTextField.value + fsFooter;
  try {
    initShader(fragmentShader, fsSource, { alert: false });
    errorLog.textContent = "";
    return true;
  } catch (err) {
    errorLog.textContent = err.toString();
    return false;
  }
}

export function setupShaderProgram() {
  const success = setupFragmentShader();
  if (!success) return;

  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    errorLog.textContent = "Error: Failed to link shader program:\n" +
      gl.getProgramInfoLog(shaderProgram);
  }
}

// Set up the initial shader program.
setupShaderProgram();

export default function plot(pos, scale) {
  gl.viewport(0, 0, canvas.width, canvas.height);

  clear();

  gl.useProgram(shaderProgram);

  // Set all our uniforms
  gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "threshold"),
    parseFloat(thresholdSlider.value),
  );

  gl.uniform2f(gl.getUniformLocation(shaderProgram, "pos"), ...pos);
  gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "scale"),
    scale / devicePixelRatio,
  );

  gl.uniform2f(
    gl.getUniformLocation(shaderProgram, "center"),
    canvas.width / 2,
    canvas.height / 2,
  );

  // TODO: actual anti-aliasing, the toggle we set in `getContext` seems to do nothing.
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
