# Infracciones AR

Consulta unificada de infracciones de tránsito en Argentina.

## Estructura

```
/                   ← frontend (Netlify sirve esto)
├── index.html
├── style.css
├── app.js
└── backend/        ← backend Puppeteer (Railway)
    ├── Dockerfile
    ├── package.json
    ├── server.js
    └── scrapers/
```

## Deploy frontend en Netlify

1. Subí este repo a GitHub
2. En netlify.app → New site from Git → elegí el repo
3. Build command: (vacío)
4. Publish directory: `.` (punto — raíz del repo)
5. Deploy

## Deploy backend en Railway

1. En railway.app → New Project → Deploy from GitHub repo
2. En Settings → Root Directory → escribí `backend`
3. Railway usa el Dockerfile automáticamente
4. Una vez deployado, copiá la URL pública

## Conectar frontend con backend

Abrí el sitio en Netlify, hacé clic en ⚙ (esquina inferior derecha) y pegá la URL del backend de Railway.
La URL se guarda en el navegador (localStorage).
