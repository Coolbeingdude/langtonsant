import init, { LangtonsAnt } from "./pkg/langtonsant.js";

function generatePalette(count) {
    const palette = [
        Uint8Array.of(255, 255, 255, 255),
        Uint8Array.of(20, 20, 20, 255),
    ];

    for (let i = 2; i < count; i++) {
        const hue = Math.round(((i - 2) * 360) / Math.max(1, count - 2));
        palette.push(hslToRgba(hue, 85, 55));
    }

    return palette;
}

function hslToRgba(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

    return Uint8Array.of(
        Math.round(f(0) * 255),
        Math.round(f(8) * 255),
        Math.round(f(4) * 255),
        255
    );
}

async function run() {
    await init();

    const width = 200;
    const height = 200;

    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const colorCountInput = document.getElementById("colorCount");
    const ruleInput = document.getElementById("ruleInput");
    const antCountInput = document.getElementById("antCount");
    const speedSlider = document.getElementById("speedSlider");
    const speedMult = document.getElementById("speedMult");
    const speedValue = document.getElementById("speedValue");
    const pauseBtn = document.getElementById("pauseBtn");
    const applyBtn = document.getElementById("applyBtn");

    const stepInput = document.getElementById("stepInput");
    const backTenBtn = document.getElementById("backTenBtn");
    const prevStepBtn = document.getElementById("prevStepBtn");
    const nextStepBtn = document.getElementById("nextStepBtn");
    const fwdTenBtn = document.getElementById("fwdTenBtn");
    const goStepBtn = document.getElementById("goStepBtn");

    let isPaused = false;
    let stepsPerFrame = 100;
    let palette = generatePalette(parseInt(colorCountInput.value, 10));

    const sim = new LangtonsAnt(
        width,
        height,
        ruleInput.value,
        parseInt(antCountInput.value, 10)
    );

    function updateSpeed() {
        const base = parseInt(speedSlider.value, 10);
        const mult = parseInt(speedMult.value, 10);
        stepsPerFrame = base * mult;
        speedValue.textContent = stepsPerFrame.toLocaleString();
    }

    function updateStepControlsState() {
        stepInput.disabled = !isPaused;
        backTenBtn.disabled = !isPaused;
        prevStepBtn.disabled = !isPaused;
        nextStepBtn.disabled = !isPaused;
        fwdTenBtn.disabled = !isPaused;
        goStepBtn.disabled = !isPaused;
        stepInput.value = sim.current_step();
    }

    speedSlider.addEventListener("input", updateSpeed);
    speedMult.addEventListener("change", updateSpeed);

    pauseBtn.addEventListener("click", () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? "Play" : "Pause";
        updateStepControlsState();
    });

    function jumpToStep(target) {
        if (!isPaused) return;
        const clamped = Math.max(0, Math.floor(target) || 0);
        sim.seek_to_step(clamped);
        stepInput.value = sim.current_step();
    }

    goStepBtn.addEventListener("click", () => {
        jumpToStep(parseInt(stepInput.value, 10));
    });

    stepInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            jumpToStep(parseInt(stepInput.value, 10));
        }
    });

    backTenBtn.addEventListener("click", () => jumpToStep(sim.current_step() - 10));
    prevStepBtn.addEventListener("click", () => jumpToStep(sim.current_step() - 1));
    nextStepBtn.addEventListener("click", () => jumpToStep(sim.current_step() + 1));
    fwdTenBtn.addEventListener("click", () => jumpToStep(sim.current_step() + 10));

    colorCountInput.addEventListener("input", () => {
        const count = Math.max(2, Math.min(24, parseInt(colorCountInput.value, 10) || 2));
        const ants = Math.max(1, Math.min(50, parseInt(antCountInput.value, 10) || 1));
        const moves = ["R", "L", "S", "U"];
        let newRule = "";

        for (let i = 0; i < count; i++) {
            newRule += moves[Math.floor(Math.random() * moves.length)];
        }

        ruleInput.value = newRule;
        palette = generatePalette(count);
        sim.set_config(newRule, ants);
        stepInput.value = sim.current_step();
    });

    applyBtn.addEventListener("click", () => {
        const cleaned = ruleInput.value.toUpperCase().replace(/[^RLSU]/g, "") || "RL";
        const ants = Math.max(1, Math.min(50, parseInt(antCountInput.value, 10) || 1));

        ruleInput.value = cleaned;
        colorCountInput.value = cleaned.length;
        antCountInput.value = ants;
        palette = generatePalette(cleaned.length);
        sim.set_config(cleaned, ants);
        stepInput.value = sim.current_step();
    });

    function render() {
        if (!isPaused) {
            sim.step_many(stepsPerFrame);
            stepInput.value = sim.current_step();
        }

        const grid = sim.grid_bytes();
        for (let i = 0; i < grid.length; i++) {
            const color = palette.at(grid.at(i)) || palette.at(0);
            const pixelIdx = i * 4;
            data[pixelIdx] = color.at(0);
            data[pixelIdx + 1] = color.at(1);
            data[pixelIdx + 2] = color.at(2);
            data[pixelIdx + 3] = color.at(3);
        }

        const positions = sim.ant_positions();
        for (let i = 0; i < positions.length; i += 2) {
            const antIdx = (positions.at(i + 1) * width + positions.at(i)) * 4;
            data[antIdx] = 0;
            data[antIdx + 1] = 255;
            data[antIdx + 2] = 0;
            data[antIdx + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

run();
