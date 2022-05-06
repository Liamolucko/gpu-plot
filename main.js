import plot, { setupShaderProgram } from "./plot.js";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("plot");

/** @type {HTMLInputElement} */
const shaderTextField = document.getElementById("shader");
/** @type {HTMLInputElement} */
const thresholdSlider = document.getElementById("threshold-slider");

shaderTextField.oninput = () => {
    // Re-initialise the shader with the new program
    setupShaderProgram();
    // then plot again
    plot();
};

thresholdSlider.oninput = plot;

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

    plot();
});

observer.observe(canvas, { box: "device-pixel-content-box" });
