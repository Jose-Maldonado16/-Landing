# 🍦 DulceMania — Landing Page

Landing page del sistema web de pedidos en línea de la **Cafetería y Heladería Sucre**.
Construida con **HTML5 + CSS3 + JavaScript vanilla**, lista para Render.

## 📁 Estructura

```
dulcemania-landing/
├── index.html
├── css/
│   ├── styles.css
│   └── responsive.css
├── js/
│   ├── main.js
│   └── menu.js
├── assets/
│   └── favicon.svg
├── render.yaml
├── .gitignore
└── README.md
```

## 🚀 Ejecutar localmente

```bash
# Opción 1: Python
python -m http.server 5173

# Opción 2: Node
npx serve . -p 5173
```

Luego abre http://localhost:5173

## ☁️ Desplegar en Render

1. Sube el proyecto a GitHub.
2. Render → **New +** → **Static Site**.
3. Conecta el repo.
4. **Build Command:** *(vacío)*
5. **Publish Directory:** `.`
6. **Create Static Site**.

## ✨ Secciones

- Hero con CTA "Pedir Ahora" y "Ver Menú"
- Propuesta de valor (sin esperas, personalización, pagos)
- **Menú interactivo** con filtros por categoría (helados, pasteles, panes, bebidas)
- Beneficios (catálogo, seguimiento, pagos)
- **Cómo pedir** con tabs (Clientes ↔ Personal interno)
- Testimonios de clientes y personal
- CTA final + Footer completo

## 🎨 Personalización

Los colores están en `:root` en `css/styles.css`. Cambia `--brand-500` (rosa fresa) y `--accent-500` (amarillo) para ajustar la paleta.

## 📄 Licencia

MIT — Proyecto académico SIS324 Ingeniería de Software, USFX.