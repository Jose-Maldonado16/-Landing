# 🐾 Plataforma de Cuidado de Mascotas — Landing Page

Landing page estática construida con **HTML5 + CSS3 + JavaScript vanilla**.
Sin frameworks, sin build step, lista para desplegar en Render.

## 📁 Estructura

```
pet-care-landing/
├── index.html
├── css/
│   ├── styles.css
│   └── responsive.css
├── js/
│   ├── main.js
│   └── tabs.js
├── assets/
│   └── favicon.svg
├── render.yaml
├── .gitignore
└── README.md
```

## 🚀 Ejecutar localmente

### Opción 1: Abrir directamente
Abre `index.html` en tu navegador.

### Opción 2: Servidor local (recomendado)
```bash
# Con Python 3
python -m http.server 5173

# Con Node (npx)
npx serve . -p 5173
```

Luego visita: [http://localhost:5173](http://localhost:5173)

## ☁️ Desplegar en Render (Static Site)

### 1. Sube el proyecto a GitHub

```bash
git init
git add .
git commit -m "Landing page inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pet-care-landing.git
git push -u origin main
```

### 2. Crea el Static Site en Render

1. Entra a [render.com](https://render.com) → **New +** → **Static Site**.
2. Conecta tu repositorio `pet-care-landing`.
3. Configura:
   - **Name:** `pet-care-landing`
   - **Branch:** `main`
   - **Build Command:** *(dejar vacío)*
   - **Publish Directory:** `.`
4. Click en **Create Static Site**.

En 1-2 minutos tendrás tu URL: `https://pet-care-landing.onrender.com`

### 3. Alternativa: usar `render.yaml` (Blueprint)

Si prefieres infraestructura como código, Render detectará el `render.yaml` automáticamente:

1. **New +** → **Blueprint**.
2. Conecta el repo.
3. Render leerá `render.yaml` y creará el servicio.

## ✨ Características

- ✅ Navbar fija con efecto al hacer scroll
- ✅ Menú hamburguesa responsive
- ✅ Hero con animaciones (float, fade-in, slide-up)
- ✅ Sección de servicios con imágenes
- ✅ Beneficios con íconos SVG
- ✅ Tabs interactivos (Dueños ↔ Cuidadores)
- ✅ Testimonios con avatares
- ✅ CTA final con doble acción
- ✅ Footer completo con redes sociales
- ✅ Smooth scroll con offset
- ✅ Accesibilidad (`aria-expanded`, `prefers-reduced-motion`)
- ✅ 100% responsive mobile-first

## 🎨 Personalización

Los colores están centralizados en variables CSS (`:root`) dentro de `css/styles.css`. Cambia `--brand-500` y `--accent-500` para ajustar la paleta completa.

## 📄 Licencia

MIT — libre para uso personal y comercial.