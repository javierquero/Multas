# Infracciones AR — Backend

Servidor Node.js con Puppeteer que hace scraping real en los sitios oficiales.
Usa un Chrome headless para navegar como un usuario real — sin CORS, sin 403.

---

## Deploy en Railway (gratis, 5 minutos)

### 1. Crear cuenta en Railway
Entrá a https://railway.app y creá una cuenta gratis (con GitHub).

### 2. Subir el código
Opción A — GitHub:
1. Creá un repo en GitHub y subí esta carpeta `infracciones-backend`
2. En Railway: New Project → Deploy from GitHub repo → elegí el repo

Opción B — Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### 3. Configurar variables de entorno (opcional)
En Railway → Variables:
```
PORT=3000
```
Railway asigna el puerto automáticamente via $PORT.

### 4. Obtener la URL del backend
Railway te da una URL pública tipo:
`https://infracciones-backend-production.up.railway.app`

Copiá esa URL — la vas a pegar en la extensión Chrome.

---

## Configurar la extensión

Abrí el archivo `popup.js` de la extensión y cambiá esta línea:

```js
const BACKEND_URL = 'https://TU-URL.up.railway.app';
```

Reemplazá `TU-URL` con la URL que te dio Railway.

---

## Probar localmente

```bash
npm install
npm start
```

Luego en otra terminal:
```bash
curl -X POST http://localhost:3000/consultar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"patente","valor":"AB123CD","sitios":["caba","pba","lanus","avellaneda"]}'
```

---

## Endpoints

### GET /
Health check → `{ status: "ok" }`

### POST /consultar
Body:
```json
{
  "tipo": "patente",
  "valor": "AB123CD",
  "sitios": ["caba", "pba", "lanus", "avellaneda"]
}
```

Respuesta:
```json
{
  "ok": true,
  "resultados": [
    {
      "id": "caba",
      "nombre": "Ciudad de Buenos Aires",
      "estado": "sin_infracciones",
      "infracciones": [],
      "urlConsulta": "https://..."
    }
  ]
}
```

Estados posibles: `con_infracciones` | `sin_infracciones` | `sin_datos` | `error` | `captcha` | `no_soportado`

---

## Notas

- Puppeteer descarga Chromium automáticamente al hacer `npm install`
- Railway plan Starter es gratis con 500hs/mes — suficiente para uso personal
- El browser se reutiliza entre requests para no abrir uno por consulta
- Timeout de 20s por sitio; las consultas corren en paralelo
