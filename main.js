import plot, { setupShaderProgram } from "./plot.js";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("plot");

/** @type {HTMLInputElement} */
const shaderTextField = document.getElementById("shader");
/** @type {HTMLInputElement} */
const thresholdSlider = document.getElementById("threshold-slider");

/** The position of the center of the canvas on the plane. */
let cameraPos = [0, 0];
/** The length of the side of one logical pixel on the plane. */
let scale = 0.01;

let targetScale = scale;
/**
 * The position on the screen that the mouse was at when the camera started to
 * zoom, which should be kept as the same position on the plane.
 * This is superseded by any gestures that are occuring.
 */
let zoomFocus;

/**
 * Calculates what the next value of an animated value should be, if its
 * previous value was `prev`, its target value is `target`, and `elapsed`
 * milliseconds have elapsed.
 */
function nextValue(prev, target, elapsed) {
  /** The proportion of the distance that should be covered every millisecond. */
  const p = 0.01;
  // dx/dt = p(target - x)
  // dt/dx = 1/p(target - x)
  // t = (1/p) * -ln|target - x| + c
  //   = -(1/p)ln|target - x| + c
  // When t = 0, x = prev
  // 0 = -(1/p)ln|target - prev| + c
  // c = (1/p)ln|target - prev|
  //
  // t = (1/p)ln|(target - prev)/(target - x)|
  // ln|(target - prev)/(target - x)| = pt
  // (target - prev)/(target - x) = e^pt
  // target - x = (target - prev)/e^pt
  // x = target - (target - prev)e^-pt
  return target - (target - prev) * Math.exp(-p * elapsed);
}

/**
 * If the camera is currently being animated, the last time it was updated.
 * Otherwise, null.
 * This can also be set to null to cancel the camera animation.
 */
let lastFrame = null;
function updateCamera(now) {
  if (lastFrame === null) {
    return;
  }

  const elapsed = now - lastFrame;
  lastFrame = now;

  const screenFocus = getGestureInfo()?.pos ?? zoomFocus;
  const focus = screenToPlane(screenFocus);
  scale = nextValue(scale, targetScale, elapsed);
  // focus = screenToPlane(screenFocus)
  //       = cameraPos + screenFocus * scale
  // cameraPos = focus - screenFocus * scale
  cameraPos[0] = focus[0] - screenFocus[0] * scale;
  cameraPos[1] = focus[1] - screenFocus[1] * scale;

  plot(cameraPos, scale);

  if (Math.abs(scale - targetScale) >= Number.EPSILON) {
    // Continue animating next frame.
    requestAnimationFrame(updateCamera);
  } else {
    lastFrame = null;
  }
}

shaderTextField.oninput = () => {
  // Re-initialise the shader with the new program
  setupShaderProgram();
  // then plot again
  plot(cameraPos, scale);
};

thresholdSlider.oninput = () => plot(cameraPos, scale);

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.devicePixelContentBoxSize) {
      const size = entry.devicePixelContentBoxSize[0];
      canvas.width = size.inlineSize;
      canvas.height = size.blockSize;
    } else {
      // Safari doesn't support `device-pixel-content-box` yet,
      // so fall back on scaling with `devicePixelRatio`.
      const size = entry.contentRect;
      canvas.width = size.width * devicePixelRatio;
      canvas.width = size.height * devicePixelRatio;
    }
  }

  plot(cameraPos, scale);
});

observer.observe(canvas, { box: "device-pixel-content-box" });

/**
 * Gets the centered position of a pointer from a `MouseEvent` (extended by
 * `PointerEvent` and `WheelEvent`).
 * */
function getCenteredPos(ev) {
  const centeredX = ev.offsetX - canvas.width / (2 * devicePixelRatio);
  const centeredY = -(ev.offsetY - canvas.height / (2 * devicePixelRatio));
  return [centeredX, centeredY];
}

/**
 * Converts from a position on the screen to the corresponding position on the
 * plane.
 */
function screenToPlane(pos) {
  return [cameraPos[0] + pos[0] * scale, cameraPos[1] + pos[1] * scale];
}

/// Gets the current position and scale of the current gesture.
/// If it isn't actually a 2-finger gesture, scale will just be 1.
function getGestureInfo() {
  const positions = Array.from(pointers.values());
  let pos = [];
  let scale = 1;
  if (positions.length === 2) {
    pos[0] = (positions[0][0] + positions[1][0]) / 2;
    pos[1] = (positions[0][1] + positions[1][1]) / 2;

    const xDist = positions[1][0] - positions[0][0];
    const yDist = positions[1][1] - positions[0][1];
    scale = Math.sqrt(xDist * xDist + yDist * yDist);
  } else if (positions.length === 1) {
    pos = positions[0];
  } else {
    // There's no gesture happening, and hence no gesture info.
    return null;
  }

  return {
    pos,
    scale,
  };
}

/**
 * A map from pointer IDs to their positions on the screen.
 *
 * By 'on the screen', I mean in logical pixels relative to the center of the
 * canvas.
 *
 * * 1 pointer - drag
 * * 2 pointers - pinch
 */
const pointers = new Map();

canvas.onpointerdown = (ev) => {
  if (pointers.size < 2) {
    pointers.set(ev.pointerId, getCenteredPos(ev));
  }
};
canvas.onpointerup = canvas.onpointercancel = (ev) => {
  pointers.delete(ev.pointerId);
};

canvas.onpointermove = (ev) => {
  if (pointers.has(ev.pointerId)) {
    const prevInfo = getGestureInfo();
    pointers.set(ev.pointerId, getCenteredPos(ev));
    const info = getGestureInfo();

    /** The position on the plane that the gesture position should correspond to. */
    const pos = screenToPlane(prevInfo.pos);

    // screenToPlane(info.pos) = pos
    // cameraPos + info.pos * scale = pos
    // cameraPos = pos - info.pos * scale
    cameraPos[0] = pos[0] - info.pos[0] * scale;
    cameraPos[1] = pos[1] - info.pos[1] * scale;

    // Note that we multiply by the inverse of the change in scale here, since the
    // scale from `getGestureInfo` (distance between pointers) is the inverse of
    // `scale`: a higher `scale` means more zoomed out, whereas a higher distance
    // between pointers means more zoomed in.
    scale *= prevInfo.scale / info.scale;

    plot(cameraPos, scale);
  }
};

canvas.onwheel = (ev) => {
  zoomFocus = getCenteredPos(ev);
  targetScale *= 1.001 ** ev.deltaY;

  // Start animating the camera.
  lastFrame ??= performance.now();
  requestAnimationFrame(updateCamera);
};
