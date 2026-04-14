// CONFIGURACIÓN DEL CANVAS
const canvas = new fabric.Canvas('mainCanvas', { 
    width: window.innerWidth - 540, 
    height: window.innerHeight - 60,
    selection: true,
    backgroundColor: '#000'
});

let pixelToMm = 1, isCalibrating = false, isMeasuring = false, isMeasuringAngle = false;
let measurementCount = 0, angleCount = 0, measurements = {}, tempLines = [];
let cropper;

// --- MOTOR DE PANEO Y ZOOM ---
canvas.on('mouse:down', function(opt) {
    if (opt.e.altKey === true) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
        canvas.defaultCursor = 'grabbing';
    }
});

canvas.on('mouse:move', function(opt) {
    if (this.isDragging) {
        const e = opt.e;
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
    }
});

canvas.on('mouse:up', function() {
    this.setViewportTransform(this.viewportTransform);
    this.isDragging = false;
    canvas.defaultCursor = 'default';
});

canvas.on('mouse:wheel', function(opt) {
    let delta = opt.e.deltaY;
    let zoom = canvas.getZoom() * (0.999 ** delta);
    if (zoom > 20) zoom = 20; if (zoom < 0.01) zoom = 0.01;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault(); opt.e.stopPropagation();
});

// --- LÓGICA DE CARGA Y RECORTE ---
const imageLoader = document.getElementById('imageLoader');
const cropModal = document.getElementById('cropModal');
const imageToCrop = document.getElementById('imageToCrop');

imageLoader.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        imageToCrop.src = event.target.result;
        cropModal.style.display = 'flex';
        if (cropper) cropper.destroy();
        cropper = new Cropper(imageToCrop, { viewMode: 1, autoCropArea: 0.8 });
    };
    reader.readAsDataURL(file);
};

document.getElementById('btn-cancel-crop').onclick = () => {
    cropModal.style.display = 'none';
    if (cropper) cropper.destroy();
};

document.getElementById('btn-do-crop').onclick = () => {
    const croppedCanvas = cropper.getCroppedCanvas();
    const croppedImageData = croppedCanvas.toDataURL('image/jpeg', 0.9);
    fabric.Image.fromURL(croppedImageData, (img) => {
        canvas.clear();
        document.getElementById('results-list').innerHTML = '';
        measurements = {}; measurementCount = 0; angleCount = 0;
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: scale, scaleY: scale, originX: 'left', originY: 'top'
        });
    });
    cropModal.style.display = 'none';
    cropper.destroy();
};

// --- HERRAMIENTAS DE MEDICIÓN ---
function makeNode(p) {
    const s = 8; // Tamaño de la cruz ajustado
    // Líneas de 1px para no tapar la cortical ni el punto de intersección
    const lineH = new fabric.Line([p.x - s, p.y, p.x + s, p.y], { 
        stroke: 'red', 
        strokeWidth: 1 
    });
    const lineV = new fabric.Line([p.x, p.y - s, p.x, p.y + s], { 
        stroke: 'red', 
        strokeWidth: 1 
    });

    return new fabric.Group([lineH, lineV], {
        left: p.x,
        top: p.y,
        originX: 'center',
        originY: 'center',
        hasControls: false,
        hasBorders: false,
        selectable: true,
        opacity: 0.7 // Transparencia para ver el hueso debajo
    });
}

canvas.on('mouse:down', function(obj) {
    if (!isMeasuring && !isCalibrating && !isMeasuringAngle) return;
    if (obj.target || this.isDragging) return;

    const pointer = canvas.getPointer(obj.e);
    const p1 = { x: pointer.x, y: pointer.y };
    // Localiza esta definición dentro de canvas.on('mouse:down', ...)
const line = new fabric.Line([p1.x, p1.y, p1.x, p1.y], {
    stroke: isCalibrating ? 'yellow' : (isMeasuringAngle ? '#3498db' : '#2ecc71'),
    strokeWidth: 1.5, // Antes era 4, ahora es 1.5 para máxima visibilidad
    strokeUniform: true,
    selectable: true,
    hasControls: false,
    hasBorders: false
});
    const n1 = makeNode(p1); const n2 = makeNode(p1);
    canvas.add(line, n1, n2);

    const onMove = (opt) => {
        const p = canvas.getPointer(opt.e);
        n2.set({ left: p.x, top: p.y });
        line.set({ x2: p.x, y2: p.y });
        canvas.renderAll();
    };

    const onUp = () => {
        canvas.off('mouse:move', onMove); canvas.off('mouse:up', onUp);
        const px = Math.sqrt(Math.pow(line.x2 - line.x1, 2) + Math.pow(line.y2 - line.y1, 2));
        if (isCalibrating) {
            let val = prompt("Valor mm:", "25");
            if (val) pixelToMm = parseFloat(val) / px;
            canvas.remove(line, n1, n2); isCalibrating = false;
        } else if (isMeasuring) {
            finalizarLinea(line, n1, n2, px); isMeasuring = false;
        } else if (isMeasuringAngle) {
            tempLines.push({ line, n1, n2 }); vincularEventos(line, n1, n2);
            if (tempLines.length === 2) {
                finalizarAngulo(tempLines[0], tempLines[1]); tempLines = []; isMeasuringAngle = false;
            }
        }
        canvas.defaultCursor = 'default';
    };
    canvas.on('mouse:move', onMove); canvas.on('mouse:up', onUp);
});

function finalizarLinea(line, n1, n2, px) {
    measurementCount++; const id = `m_${Date.now()}`;
    measurements[id] = { line, n1, n2, type: 'distancia' };
    line.measurementId = id; vincularEventos(line, n1, n2);
    agregarAlPanel(id, `Medida ${measurementCount}`, `${(px * pixelToMm).toFixed(2)} mm`);
}

function finalizarAngulo(o1, o2) {
    angleCount++; const id = `a_${Date.now()}`;
    measurements[id] = { line1: o1.line, n1: o1.n1, n1b: o1.n2, line2: o2.line, n2: o2.n1, n2b: o2.n2, type: 'angulo' };
    o1.line.measurementId = o2.line.measurementId = id;
    agregarAlPanel(id, `Ángulo ${angleCount}`, `${calcularAngulo(o1.line, o2.line)}°`);
}

function calcularAngulo(l1, l2) {
    const a1 = Math.atan2(l1.y2 - l1.y1, l1.x2 - l1.x1);
    const a2 = Math.atan2(l2.y2 - l2.y1, l2.x2 - l2.x1);
    let res = Math.abs((a1 - a2) * 180 / Math.PI);
    return (res > 180 ? 360 - res : res).toFixed(1);
}

// --- VINCULACIÓN DE MOVIMIENTO EN BLOQUE ---
function vincularEventos(line, n1, n2) {
    const updateAll = (e) => {
        if (e.target === line) {
            // Si movemos la línea, los nodos se actualizan a sus extremos
            n1.set({ left: line.x1 + line.left - line.width/2, top: line.y1 + line.top - line.height/2 }); // Simplificado
            // Corrección de posición de nodos al mover línea
            const p1 = line.getPointByOrigin('left', 'top');
            const p2 = line.getPointByOrigin('right', 'bottom');
            n1.set({ left: line.x1, top: line.y1 }); // En Fabric, x1/y1 son relativos tras mover
            // Para asegurar precisión absoluta:
            n1.set({ left: line.left + (line.x1 - (line.x1+line.x2)/2), top: line.top + (line.y1 - (line.y1+line.y2)/2) });
            n2.set({ left: line.left + (line.x2 - (line.x1+line.x2)/2), top: line.top + (line.y2 - (line.y1+line.y2)/2) });
        } else {
            // Si movemos un nodo, la línea se estira
            line.set({ x1: n1.left, y1: n1.top, x2: n2.left, y2: n2.top });
        }
        n1.setCoords(); n2.setCoords(); line.setCoords();
        actualizarValoresPanel(line.measurementId);
    };

    line.on('moving', updateAll);
    n1.on('moving', updateAll);
    n2.on('moving', updateAll);
}

function actualizarValoresPanel(id) {
    const m = measurements[id];
    const valSpan = document.getElementById(`val-${id}`);
    if (m.type === 'distancia') {
        const px = Math.sqrt(Math.pow(m.line.x2 - m.line.x1, 2) + Math.pow(m.line.y2 - m.line.y1, 2));
        valSpan.innerText = `${(px * pixelToMm).toFixed(2)} mm`;
    } else {
        valSpan.innerText = `${calcularAngulo(m.line1, m.line2)}°`;
    }
}

function agregarAlPanel(id, nombre, valor) {
    const div = document.createElement('div'); div.className = 'result-item'; div.id = `item-${id}`;
    div.innerHTML = `<strong>${nombre}</strong> <span id="val-${id}">${valor}</span><br>
                     <button class="visibility-btn" onclick="toggleVisibility('${id}')">Ojo</button>`;
    document.getElementById('results-list').appendChild(div);
}

window.toggleVisibility = function(id) {
    const m = measurements[id];
    const isVis = m.type === 'distancia' ? !m.line.visible : !m.line1.visible;
    if (m.type === 'distancia') { m.line.visible = m.n1.visible = m.n2.visible = isVis; }
    else { m.line1.visible = m.n1.visible = m.n1b.visible = m.line2.visible = m.n2.visible = m.n2b.visible = isVis; }
    canvas.renderAll();
};

document.getElementById('btn-download').onclick = () => {
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.download = `orthoplan-${Date.now()}.png`;
    link.href = dataURL; link.click();
};

document.getElementById('btn-undo').onclick = () => {
    const ids = Object.keys(measurements); if (ids.length === 0) return;
    const lastId = ids[ids.length - 1], m = measurements[lastId];
    if (m.type === 'distancia') canvas.remove(m.line, m.n1, m.n2);
    else canvas.remove(m.line1, m.n1, m.n1b, m.line2, m.n2, m.n2b);
    document.getElementById(`item-${lastId}`).remove(); delete measurements[lastId];
    canvas.renderAll();
};

document.getElementById('btn-calibrate').onclick = () => { isCalibrating = true; isMeasuring = isMeasuringAngle = false; canvas.defaultCursor = 'crosshair'; };
document.getElementById('btn-line').onclick = () => { isMeasuring = true; isCalibrating = isMeasuringAngle = false; canvas.defaultCursor = 'crosshair'; };
document.getElementById('btn-angle').onclick = () => { isMeasuringAngle = true; isCalibrating = isMeasuring = false; canvas.defaultCursor = 'crosshair'; };