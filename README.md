# OrthoPlan Pro

Herramienta de planificacion quirurgica y biomecanica para mediciones sobre imagenes de rayos X.

## Funcionalidades

- **Carga de radiografia** con recorte interactivo (Cropper.js)
- **Calibracion** en milimetros a partir de una referencia conocida
- **Medicion de distancia** lineal con label en tiempo real
- **Medicion de angulo** (2 modos):
  - Angulo V1: dos trazos independientes (click-arrastra x2)
  - Angulo V2: tres clicks (punto A, vertice, punto B) con linea fantasma de preview
- **Arco visual** en el vertice del angulo
- **Labels** sobre las lineas de medicion
- Zoom (rueda del raton) y paneo (Alt + arrastrar)
- Visibilidad toggle por medicion
- Deshacer ultima medicion
- Exportar imagen con anotaciones (PNG)

## Tecnologias

- [Fabric.js](http://fabricjs.com/) 5.3.1 - Canvas interactivo
- [Cropper.js](https://fengyuanchen.github.io/cropperjs/) 1.6.1 - Recorte de imagen
- HTML / CSS / JavaScript vanilla

## Uso

Abrir `index.html` en un navegador. No requiere servidor ni build.
