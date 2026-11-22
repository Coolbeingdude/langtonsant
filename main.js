import init, { LangtonsAnt } from "./pkg/langtonsant.js";


function hslToRgb(h, s, l) {
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


function generatePalette(count) {
    return buildFlatPalette(count);
}

function buildFlatPalette(count) {
    const flat = new Uint8Array(count * 4);
    // 0: White
    flat.set([255, 255, 255, 255], 0);
    // 1: Dark charcoal
    if (count > 1) flat.set([20, 20, 20, 255], 4);
    // 2..count-1: Distinct evenly spaced hues
    for (let i = 2; i < count; i++) {
        const hue = Math.round(((i - 2) * 360) / Math.max(1, count - 2));
        const [r, g, b] = hslToRgb(hue, 85, 55);
        flat.set([r, g, b, 255], i * 4);
    }
    return flat;
}



async function run() {
    await init();

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const hudText = document.getElementById("hudText");

    const colorCountInput = document.getElementById("colorCount");
    const ruleInput = document.getElementById("ruleInput");
    const speedSlider = document.getElementById("speedSlider");
    const speedMult = document.getElementById("speedMult");
    const speedValue = document.getElementById("speedValue");
    const pauseBtn = document.getElementById("pauseBtn");
    const resetBtn = document.getElementById("resetBtn");
    const centerCamBtn = document.getElementById("centerCamBtn");
    const gridLinesToggle = document.getElementById("gridLinesToggle");

    const stepInput = document.getElementById("stepInput");
    const backTenBtn = document.getElementById("backTenBtn");
    const prevStepBtn = document.getElementById("prevStepBtn");
    const nextStepBtn = document.getElementById("nextStepBtn");
    const fwdTenBtn = document.getElementById("fwdTenBtn");
    const goStepBtn = document.getElementById("goStepBtn");

    const antList = document.getElementById("antList");
    const addAntBtn = document.getElementById("addAntBtn");
    const clearAntsBtn = document.getElementById("clearAntsBtn");

    let camX = 0;
    let camY = 0;
    let cellSize = 6;
    let isDragging = false;
    let dragMoved = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let hoverWorldX = 0;
    let hoverWorldY = 0;

    let isPaused = false;
    let stepsPerFrame = 100;
    let palette = generatePalette(parseInt(colorCountInput.value, 10));
    let flatPalette = buildFlatPalette(parseInt(colorCountInput.value, 10));
    let frameCounter = 0;

    const sim = new LangtonsAnt(ruleInput.value, 1);

    function screenToWorld(px, py) {
        const wx = Math.floor(camX + (px - canvas.width / 2) / cellSize);
        const wy = Math.floor(camY + (py - canvas.height / 2) / cellSize);
        return [wx, wy];
    }

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const worldBeforeX = camX + (mx - canvas.width / 2) / cellSize;
        const worldBeforeY = camY + (my - canvas.height / 2) / cellSize;

        const zoomFactor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        cellSize = Math.max(0.25, Math.min(64, cellSize * zoomFactor));

        camX = worldBeforeX - (mx - canvas.width / 2) / cellSize;
        camY = worldBeforeY - (my - canvas.height / 2) / cellSize;
    }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            isDragging = true;
            dragMoved = false;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    window.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const [wx, wy] = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        hoverWorldX = wx;
        hoverWorldY = wy;

        if (!isDragging) return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragMoved = true;
        }
        camX -= dx / cellSize;
        camY -= dy / cellSize;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    window.addEventListener("mouseup", (e) => {
        if (isDragging && e.button === 0) {
            isDragging = false;
            if (!dragMoved && e.target === canvas) {
                const rect = canvas.getBoundingClientRect();
                const [gx, gy] = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
                sim.add_ant(gx, gy, 0);
                rebuildAntList();
            }
        }
    });

    centerCamBtn.addEventListener("click", () => {
        camX = 0;
        camY = 0;
        cellSize = 6;
    });

    function dirSelectHtml(selectedDir, cls) {
        const dirs = ["Up", "Right", "Down", "Left"];
        const opts = dirs.map((name, idx) => {
            const sel = idx === selectedDir ? "selected" : "";
            return `<option value="${idx}" ${sel}>${name}</option>`;
        }).join("");
        return `<select class="${cls}">${opts}</select>`;
    }

    function rebuildAntList() {
        const details = sim.ant_details();
        antList.innerHTML = "";

        for (let i = 0; i < details.length; i += 6) {
            const antIdx = i / 6;
            const card = document.createElement("div");
            card.className = "ant-card";
            card.innerHTML = `
                <div class="ant-row">
                    <strong>Ant #${antIdx + 1}</strong>
                    <div style="display:flex; gap:4px;">
                        <button class="secondary focus-btn" style="padding:4px 8px; font-size:12px;">Focus</button>
                        <button class="danger remove-btn">Remove</button>
                    </div>
                </div>
                <div class="ant-row">
                    <span>Now:</span>
                    <label>X <input type="number" class="cur-x" value="${details.at(i)}"></label>
                    <label>Y <input type="number" class="cur-y" value="${details.at(i + 1)}"></label>
                    ${dirSelectHtml(details.at(i + 2), "cur-dir")}
                </div>
                <div class="ant-row">
                    <span>Init:</span>
                    <label>X <input type="number" class="init-x" value="${details.at(i + 3)}"></label>
                    <label>Y <input type="number" class="init-y" value="${details.at(i + 4)}"></label>
                    ${dirSelectHtml(details.at(i + 5), "init-dir")}
                </div>
            `;

            const commitChange = () => {
                const nx = parseInt(card.querySelector(".cur-x").value, 10) || 0;
                const ny = parseInt(card.querySelector(".cur-y").value, 10) || 0;
                const nd = parseInt(card.querySelector(".cur-dir").value, 10) || 0;
                const ix = parseInt(card.querySelector(".init-x").value, 10) || 0;
                const iy = parseInt(card.querySelector(".init-y").value, 10) || 0;
                const id = parseInt(card.querySelector(".init-dir").value, 10) || 0;
                sim.update_ant(antIdx, nx, ny, nd, ix, iy, id);
            };

            card.querySelectorAll("input, select").forEach(el => el.addEventListener("change", commitChange));
            card.querySelector(".focus-btn").addEventListener("click", () => {
                camX = parseInt(card.querySelector(".cur-x").value, 10) || 0;
                camY = parseInt(card.querySelector(".cur-y").value, 10) || 0;
            });
            card.querySelector(".remove-btn").addEventListener("click", () => {
                sim.remove_ant(antIdx);
                rebuildAntList();
            });

            antList.appendChild(card);
        }
    }

    function syncLiveAntInputs() {
        const details = sim.ant_details();
        const cards = antList.querySelectorAll(".ant-card");
        if (cards.length * 6 !== details.length) {
            rebuildAntList();
            return;
        }
        cards.forEach((card, idx) => {
            const base = idx * 6;
            const curX = card.querySelector(".cur-x");
            const curY = card.querySelector(".cur-y");
            const curDir = card.querySelector(".cur-dir");
            if (document.activeElement !== curX) curX.value = details.at(base);
            if (document.activeElement !== curY) curY.value = details.at(base + 1);
            if (document.activeElement !== curDir) curDir.value = details.at(base + 2);
        });
    }

    addAntBtn.addEventListener("click", () => {
        sim.add_ant(Math.round(camX), Math.round(camY), 0);
        rebuildAntList();
    });

    clearAntsBtn.addEventListener("click", () => {
        sim.clear_ants();
        rebuildAntList();
    });

    function updateSpeed() {
        stepsPerFrame = parseInt(speedSlider.value, 10) * parseInt(speedMult.value, 10);
        speedValue.textContent = stepsPerFrame.toLocaleString();
    }

    function updateStepControlsState() {
        [stepInput, backTenBtn, prevStepBtn, nextStepBtn, fwdTenBtn, goStepBtn].forEach(el => {
            el.disabled = !isPaused;
        });
        stepInput.value = sim.current_step();
    }

    speedSlider.addEventListener("input", updateSpeed);
    speedMult.addEventListener("change", updateSpeed);

    pauseBtn.addEventListener("click", () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? "Play" : "Pause";
        updateStepControlsState();
        syncLiveAntInputs();
    });

    function jumpToStep(target) {
        if (!isPaused) return;
        const parsed = Number.isFinite(target) ? Math.floor(target) : 0;
        sim.seek_to_step(Math.max(0, Math.min(5000000, parsed)));
        stepInput.value = sim.current_step();
        syncLiveAntInputs();
    }

    goStepBtn.addEventListener("click", () => jumpToStep(parseInt(stepInput.value, 10)));
    stepInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") jumpToStep(parseInt(stepInput.value, 10));
    });
    backTenBtn.addEventListener("click", () => jumpToStep(sim.current_step() - 10));
    prevStepBtn.addEventListener("click", () => jumpToStep(sim.current_step() - 1));
    nextStepBtn.addEventListener("click", () => jumpToStep(sim.current_step() + 1));
    fwdTenBtn.addEventListener("click", () => jumpToStep(sim.current_step() + 10));

    colorCountInput.addEventListener("input", () => {
        const count = Math.max(2, Math.min(24, parseInt(colorCountInput.value, 10) || 2));
        const moves = ["R", "L", "S", "U"];
        let newRule = "";
        for (let i = 0; i < count; i++) {
            newRule += moves[Math.floor(Math.random() * moves.length)];
        }
        ruleInput.value = newRule;
        palette = generatePalette(count);
        sim.set_rules(newRule);
        stepInput.value = sim.current_step();
        syncLiveAntInputs();
    });

    resetBtn.addEventListener("click", () => {
        const cleaned = ruleInput.value.toUpperCase().replace(/[^RLSU]/g, "") || "RL";
        ruleInput.value = cleaned;
        colorCountInput.value = cleaned.length;
        palette = generatePalette(cleaned.length);
        sim.set_rules(cleaned);
        stepInput.value = sim.current_step();
        syncLiveAntInputs();
    });

        function render() {
        if (!isPaused) {
            sim.step_many(stepsPerFrame);
            stepInput.value = sim.current_step();
            frameCounter++;
            if (frameCounter % 10 === 0) {
                syncLiveAntInputs();
            }
        }

        const pixels = sim.render_viewport(
            canvas.width,
            canvas.height,
            camX,
            camY,
            cellSize,
            flatPalette
        );
        ctx.putImageData(
            new ImageData(new Uint8ClampedArray(pixels), canvas.width, canvas.height),
            0,
            0
        );

        const halfW = canvas.width / 2;
        const halfH = canvas.height / 2;
        const minX = Math.floor(camX - halfW / cellSize) - 1;
        const maxX = Math.ceil(camX + halfW / cellSize) + 1;
        const minY = Math.floor(camY - halfH / cellSize) - 1;
        const maxY = Math.ceil(camY + halfH / cellSize) + 1;

        if (gridLinesToggle.checked && cellSize >= 5) {
            ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let gx = minX; gx <= maxX; gx++) {
                const sx = Math.floor((gx - camX) * cellSize + halfW) + 0.5;
                ctx.moveTo(sx, 0);
                ctx.lineTo(sx, canvas.height);
            }
            for (let gy = minY; gy <= maxY; gy++) {
                const sy = Math.floor((gy - camY) * cellSize + halfH) + 0.5;
                ctx.moveTo(0, sy);
                ctx.lineTo(canvas.width, sy);
            }
            ctx.stroke();
        }

        const originX = Math.floor((0 - camX) * cellSize + halfW) + 0.5;
        const originY = Math.floor((0 - camY) * cellSize + halfH) + 0.5;
        ctx.strokeStyle = "rgba(0, 122, 204, 0.35)";
        ctx.beginPath();
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, canvas.height);
        ctx.moveTo(0, originY);
        ctx.lineTo(canvas.width, originY);
        ctx.stroke();

        const details = sim.ant_details();
        const antDrawSize = Math.max(3, cellSize);
        for (let i = 0; i < details.length; i += 6) {
            const sx = Math.floor((details.at(i) - camX) * cellSize + halfW);
            const sy = Math.floor((details.at(i + 1) - camY) * cellSize + halfH);
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(sx, sy, antDrawSize, antDrawSize);
        }

        hudText.textContent = `Camera: (${Math.round(camX)}, ${Math.round(camY)}) | Cursor: (${hoverWorldX}, ${hoverWorldY}) | Zoom: ${cellSize.toFixed(1)}px | Cells: ${sim.active_cell_count().toLocaleString()}`;
        requestAnimationFrame(render);
    }

    rebuildAntList();
    requestAnimationFrame(render);
}

run();
