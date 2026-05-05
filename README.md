# OrthoPlan Pro

Herramienta web para **planificación quirúrgica y biomecánica** sobre radiografías. Permite calibrar, medir distancias, ángulos, áreas y diámetros directamente sobre la imagen — útil para templating de prótesis, evaluación de fracturas y análisis biomecánico.

Aplicación 100% del lado del cliente: las imágenes nunca salen del navegador.

🔗 **Demo en vivo:** [https://romeldev.github.io/app-dr-verona](https://romeldev.github.io/app-dr-verona)

---

## Funcionalidades

### 📁 Carga de imagen
- Botón **Cargar Radiografía** abre cualquier imagen local.
- **Recorte interactivo** previo a la carga (Cropper.js): se selecciona el área de interés antes de empezar a medir.

### 🖐 Navegación
- **🖐 Mover** — modo paneo dedicado: click + arrastrar mueve la vista sin tener que mantener teclas.
- **🎯 Centrar** — restablece la vista al ajuste original (zoom 100% y traslación neutra).
- **Alt + arrastrar** — paneo rápido sin cambiar de herramienta.
- **Rueda del ratón** — zoom continuo (0.01× a 20×) centrado en el cursor.

### 📐 Medición

| Herramienta | Uso | Salida |
|---|---|---|
| **⚙️ Calibrar** | Click-arrastrar sobre una referencia de longitud conocida (regla, marcador) e ingresar los mm reales. | Establece el factor `pixel → mm` para todas las mediciones siguientes. |
| **📏 Distancia** | Click-arrastrar entre dos puntos. | Distancia en mm con etiqueta editable. |
| **∠ Ángulo (intersección)** | Dos trazos independientes (click-arrastrar × 2). | Ángulo en grados con arco visual en el vértice de intersección. |
| **∠ Ángulo (3 puntos)** | Tres clicks: punto A → vértice → punto B, con línea fantasma de preview. | Ángulo en grados con arco. |
| **⬭ ROI (elipse)** | Click-arrastrar para dibujar una elipse. | Área (mm²) y perímetro (mm, aproximación de Ramanujan). |
| **◯ Círculo** | Click en el centro y arrastrar hacia afuera para fijar el radio. Editable: la cruz central traslada, la cruz del borde redimensiona. | Diámetro (Ø) en mm. Ideal para templating de cabeza femoral y cotila acetabular. |

Todas las mediciones son:
- **Editables**: arrastrar sus nodos o el cuerpo recalcula el valor en vivo.
- **Etiquetadas**: cada medición tiene una etiqueta arrastrable y escalable.
- **Toggleable**: cada entrada del panel de Resultados tiene un botón **Ojo** para mostrar/ocultar.

### ✏️ Edición
- **↩ Deshacer Última** — elimina la última medición agregada (incluida etiqueta y nodos).
- **💾 Descargar Imagen** — exporta el canvas (radiografía + todas las anotaciones visibles) como PNG.

---

## Flujo típico — Templating de prótesis de cadera

1. **Cargar** la radiografía y recortar a la zona de interés.
2. **⚙️ Calibrar** sobre un marcador de tamaño conocido (esfera de calibración u otro objeto referenciado).
3. **◯ Círculo** sobre la cabeza femoral protésica → lectura del **diámetro** de la bola (28/32/36 mm típicos).
4. **◯ Círculo** sobre el reborde de la cotila acetabular → diámetro del **cup** (44–64 mm típicos).
5. **📏 Distancia** sobre el canal medular para estimar talla del vástago.
6. **∠ Ángulo (intersección)** entre eje cervical y diafisario → ángulo cérvico-diafisario.
7. **💾 Descargar** la imagen con todas las anotaciones para el informe.

---

## Privacidad

Todo el procesamiento ocurre en el navegador (FileReader → Canvas API). **Las imágenes no se suben a ningún servidor**, ni siquiera al desplegar en GitHub Pages. Esto la hace apta para entornos clínicos sensibles.

---

## Tecnologías

- [Fabric.js](http://fabricjs.com/) 5.3.1 — canvas interactivo y manipulación de objetos.
- [Cropper.js](https://fengyuanchen.github.io/cropperjs/) 1.6.1 — recorte de imagen.
- HTML / CSS / JavaScript vanilla — sin build step ni dependencias `npm`.
