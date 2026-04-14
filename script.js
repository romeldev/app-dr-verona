// CONFIGURACIÓN DEL CANVAS
const canvas = new fabric.Canvas('mainCanvas', { 
    width: window.innerWidth - 540, 
    height: window.innerHeight - 60,
    selection: true,
    backgroundColor: '#000'
});

let pixelToMm = 1, isCalibrating = false, isMeasuring = false, isMeasuringAngle = false, isAngleV2 = false;
let measurementCount = 0, angleCount = 0, measurements = {}, tempLines = [];
let angleV2Points = [], ghostLine = null;
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
    // Línea fantasma para Ángulo V.2
    if (isAngleV2 && ghostLine && angleV2Points.length > 0) {
        const p = canvas.getPointer(opt.e);
        ghostLine.set({ x2: p.x, y2: p.y });
        canvas.renderAll();
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
function makeLabel(text, x, y, color) {
    return new fabric.Text(text, {
        left: x,
        top: y,
        fontSize: 14,
        fill: color,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 3,
        originX: 'center',
        originY: 'bottom',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false
    });
}

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
    // --- Ángulo V.2: 3 clicks ---
    if (isAngleV2) {
        if (this.isDragging) return;
        canvas.discardActiveObject();
        const pointer = canvas.getPointer(obj.e);
        const node = makeNode({ x: pointer.x, y: pointer.y });
        canvas.add(node);
        angleV2Points.push({ x: pointer.x, y: pointer.y, node });

        // Remover línea fantasma anterior
        if (ghostLine) { canvas.remove(ghostLine); ghostLine = null; }

        if (angleV2Points.length === 1) {
            // Crear línea fantasma desde punto A
            ghostLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                stroke: '#3498db', strokeWidth: 1, strokeDashArray: [5, 5],
                opacity: 0.5, selectable: false, evented: false
            });
            canvas.add(ghostLine);
        } else if (angleV2Points.length === 2) {
            // Dibujar primera línea definitiva: punto A -> vértice
            const p = angleV2Points;
            const line1 = new fabric.Line([p[0].x, p[0].y, p[1].x, p[1].y], {
                stroke: '#3498db', strokeWidth: 1.5, strokeUniform: true,
                selectable: true, hasControls: false, hasBorders: false
            });
            canvas.add(line1);
            angleV2Points[0].line = line1;
            // Crear línea fantasma desde vértice
            ghostLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                stroke: '#3498db', strokeWidth: 1, strokeDashArray: [5, 5],
                opacity: 0.5, selectable: false, evented: false
            });
            canvas.add(ghostLine);
        } else if (angleV2Points.length === 3) {
            // Dibujar segunda línea definitiva: vértice -> punto B
            const p = angleV2Points;
            const line2 = new fabric.Line([p[1].x, p[1].y, p[2].x, p[2].y], {
                stroke: '#3498db', strokeWidth: 1.5, strokeUniform: true,
                selectable: true, hasControls: false, hasBorders: false
            });
            canvas.add(line2);
            const o1 = { line: p[0].line, n1: p[0].node, n2: p[1].node };
            const o2 = { line: line2, n1: p[1].node, n2: p[2].node };
            vincularEventos(o1.line, o1.n1, o1.n2);
            vincularEventos(o2.line, o2.n1, o2.n2);
            finalizarAngulo(o1, o2);
            angleV2Points = [];
            isAngleV2 = false;
            canvas.selection = true;
            canvas.skipTargetFind = false;
            canvas.defaultCursor = 'default';
            setActiveTool(null);
        }
        canvas.renderAll();
        return;
    }
    if (!isMeasuring && !isCalibrating && !isMeasuringAngle) return;
    if (this.isDragging) return;
    if (obj.target && !(isMeasuringAngle && tempLines.length > 0)) return;
    canvas.discardActiveObject();
    canvas.selection = false;

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
            } else {
                canvas.defaultCursor = 'crosshair';
                return;
            }
        }
        canvas.selection = true;
        canvas.skipTargetFind = false;
        canvas.defaultCursor = 'default';
        setActiveTool(null);
    };
    canvas.on('mouse:move', onMove); canvas.on('mouse:up', onUp);
});

function finalizarLinea(line, n1, n2, px) {
    measurementCount++; const id = `m_${Date.now()}`;
    const midX = (line.x1 + line.x2) / 2, midY = (line.y1 + line.y2) / 2;
    const valorText = `${(px * pixelToMm).toFixed(2)} mm`;
    const label = makeLabel(valorText, midX, midY, '#2ecc71');
    canvas.add(label);
    measurements[id] = { line, n1, n2, label, type: 'distancia' };
    line.measurementId = id; vincularEventos(line, n1, n2);
    agregarAlPanel(id, `Medida ${measurementCount}`, valorText);
}

function finalizarAngulo(o1, o2) {
    angleCount++; const id = `a_${Date.now()}`;
    const vertex = interseccionLineas(o1.line, o2.line);
    const valorText = `${calcularAngulo(o1.line, o2.line)}°`;
    const label = makeLabel(valorText, vertex.x + 30, vertex.y - 10, '#3498db');
    const arc = crearArco(o1.line, o2.line);
    canvas.add(arc, label);
    measurements[id] = { line1: o1.line, n1: o1.n1, n1b: o1.n2, line2: o2.line, n2: o2.n1, n2b: o2.n2, label, arc, type: 'angulo' };
    o1.line.measurementId = o2.line.measurementId = id;
    agregarAlPanel(id, `Ángulo ${angleCount}`, valorText);
}

function calcularAngulo(l1, l2) {
    // Calcular direcciones desde el vértice (intersección) hacia los extremos
    const vertex = interseccionLineas(l1, l2);
    const d1a = Math.hypot(l1.x1 - vertex.x, l1.y1 - vertex.y);
    const d1b = Math.hypot(l1.x2 - vertex.x, l1.y2 - vertex.y);
    const p1 = d1a > d1b ? { x: l1.x1, y: l1.y1 } : { x: l1.x2, y: l1.y2 };
    const d2a = Math.hypot(l2.x1 - vertex.x, l2.y1 - vertex.y);
    const d2b = Math.hypot(l2.x2 - vertex.x, l2.y2 - vertex.y);
    const p2 = d2a > d2b ? { x: l2.x1, y: l2.y1 } : { x: l2.x2, y: l2.y2 };
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let res = Math.abs((a1 - a2) * 180 / Math.PI);
    return (res > 180 ? 360 - res : res).toFixed(1);
}

function interseccionLineas(l1, l2) {
    const x1 = l1.x1, y1 = l1.y1, x2 = l1.x2, y2 = l1.y2;
    const x3 = l2.x1, y3 = l2.y1, x4 = l2.x2, y4 = l2.y2;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) {
        // Líneas paralelas: usar promedio de endpoints más cercanos
        return { x: (x2 + x3) / 2, y: (y2 + y3) / 2 };
    }
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

function crearArco(l1, l2) {
    const vertex = interseccionLineas(l1, l2);
    const r = 25;
    // Calcular dirección desde el vértice hacia el extremo más lejano de cada línea
    const d1a = Math.hypot(l1.x1 - vertex.x, l1.y1 - vertex.y);
    const d1b = Math.hypot(l1.x2 - vertex.x, l1.y2 - vertex.y);
    const p1 = d1a > d1b ? { x: l1.x1, y: l1.y1 } : { x: l1.x2, y: l1.y2 };
    const d2a = Math.hypot(l2.x1 - vertex.x, l2.y1 - vertex.y);
    const d2b = Math.hypot(l2.x2 - vertex.x, l2.y2 - vertex.y);
    const p2 = d2a > d2b ? { x: l2.x1, y: l2.y1 } : { x: l2.x2, y: l2.y2 };
    let a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    let a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    // Arco por el camino más corto (ángulo menor)
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (diff < 0) { a1 = a1 + diff; diff = -diff; }
    const largeArc = diff > Math.PI ? 1 : 0;
    const startX = vertex.x + r * Math.cos(a1);
    const startY = vertex.y + r * Math.sin(a1);
    const endX = vertex.x + r * Math.cos(a1 + diff);
    const endY = vertex.y + r * Math.sin(a1 + diff);
    const pathData = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
    return new fabric.Path(pathData, {
        fill: '', stroke: '#3498db', strokeWidth: 1.5,
        selectable: false, evented: false, hasControls: false, hasBorders: false
    });
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
        const valorText = `${(px * pixelToMm).toFixed(2)} mm`;
        valSpan.innerText = valorText;
        if (m.label) {
            const midX = (m.n1.left + m.n2.left) / 2;
            const midY = (m.n1.top + m.n2.top) / 2;
            m.label.set({ text: valorText, left: midX, top: midY });
            m.label.setCoords();
        }
    } else {
        const valorText = `${calcularAngulo(m.line1, m.line2)}°`;
        valSpan.innerText = valorText;
        const vertex = interseccionLineas(m.line1, m.line2);
        if (m.label) {
            m.label.set({ text: valorText, left: vertex.x + 30, top: vertex.y - 10 });
            m.label.setCoords();
        }
        if (m.arc) {
            canvas.remove(m.arc);
            m.arc = crearArco(m.line1, m.line2);
            m.arc.visible = m.line1.visible;
            canvas.add(m.arc);
        }
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
    if (m.label) m.label.visible = isVis;
    if (m.arc) m.arc.visible = isVis;
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
    if (m.label) canvas.remove(m.label);
    if (m.arc) canvas.remove(m.arc);
    if (m.type === 'distancia') canvas.remove(m.line, m.n1, m.n2);
    else canvas.remove(m.line1, m.n1, m.n1b, m.line2, m.n2, m.n2b);
    document.getElementById(`item-${lastId}`).remove(); delete measurements[lastId];
    canvas.renderAll();
};

const toolBtns = ['btn-calibrate', 'btn-line', 'btn-angle', 'btn-angle-v2'];
function setActiveTool(activeId) {
    toolBtns.forEach(id => document.getElementById(id).classList.remove('active-tool'));
    if (activeId) document.getElementById(activeId).classList.add('active-tool');
}
function resetModes() { isCalibrating = isMeasuring = isMeasuringAngle = isAngleV2 = false; angleV2Points = []; tempLines = []; setActiveTool(null); }
document.getElementById('btn-calibrate').onclick = () => { resetModes(); isCalibrating = true; setActiveTool('btn-calibrate'); canvas.defaultCursor = 'crosshair'; canvas.skipTargetFind = true; };
document.getElementById('btn-line').onclick = () => { resetModes(); isMeasuring = true; setActiveTool('btn-line'); canvas.defaultCursor = 'crosshair'; canvas.skipTargetFind = true; };
document.getElementById('btn-angle').onclick = () => { resetModes(); isMeasuringAngle = true; setActiveTool('btn-angle'); canvas.defaultCursor = 'crosshair'; canvas.skipTargetFind = true; };
document.getElementById('btn-angle-v2').onclick = () => { resetModes(); isAngleV2 = true; setActiveTool('btn-angle-v2'); canvas.defaultCursor = 'crosshair'; canvas.skipTargetFind = true; canvas.selection = false; };