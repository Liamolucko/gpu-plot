import plot, { setupShaderProgram } from "./plot.js";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("plot");

/** @type {HTMLInputElement} */
const shaderTextField = document.getElementById("shader");
/** @type {HTMLInputElement} */
const thresholdSlider = document.getElementById("threshold-slider");

let pos = [0, 0];
let scale = 0.01;

shaderTextField.oninput = () => {
    // Re-initialise the shader with the new program
    setupShaderProgram();
    // then plot again
    plot(pos, scale);
};

thresholdSlider.oninput = () => plot(pos, scale);

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

    plot(pos, scale);
});

observer.observe(canvas, { box: "device-pixel-content-box" });

/// Gets the centered position of a pointer from a `MouseEvent` (extended by `PointerEvent` and `WheelEvent`).
function getCenteredPos(ev) {
    const centeredX = ev.offsetX - canvas.width / (2 * devicePixelRatio);
    const centeredY = -(ev.offsetY - canvas.height / (2 * devicePixelRatio));
    return [centeredX, centeredY];
}

/// Gets the current position and scale of the current gesture.
/// If it isn't actually a 2-finger gesture, scale will just be 1.
function getGestureInfo() {
    const positions = Array.from(pointers.values());
    let pos = [];
    let scale = 1;
    if (positions.length == 2) {
        pos[0] = (positions[0][0] + positions[1][0]) / 2;
        pos[1] = (positions[0][1] + positions[1][1]) / 2;

        const xDist = positions[1][0] - positions[0][0];
        const yDist = positions[1][1] - positions[0][1];
        scale = Math.sqrt(xDist * xDist + yDist * yDist);
    } else {
        pos = positions[0];
    }

    return {
        pos,
        scale,
    };
}

// * 1 pointer - drag
// * 2 pointers - pinch
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

        // positions on the coordinate plane
        const prevX = prevInfo.pos[0] * scale;
        const prevY = prevInfo.pos[1] * scale;
        scale *= prevInfo.scale / info.scale;
        const newX = info.pos[0] * scale;
        const newY = info.pos[1] * scale;

        pos[0] += prevX - newX;
        pos[1] += prevY - newY;

        plot(pos, scale);
    }
};

canvas.onwheel = (ev) => {
    const [centeredX, centeredY] = getCenteredPos(ev);
    const prevScale = scale;
    scale *= 1.001 ** ev.deltaY;
    pos[0] += centeredX * (prevScale - scale);
    pos[1] += centeredY * (prevScale - scale);

    plot(pos, scale);
};
