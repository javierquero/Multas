# Infracciones AR — Backend

## Deploy en Railway

1. Subí esta carpeta a un repo de GitHub
2. En railway.app → New Project → Deploy from GitHub repo
3. Railway detecta el Dockerfile automáticamente y lo usa para buildear
4. Una vez deployado, copiá la URL pública (ej: `https://tu-app.up.railway.app`)
5. Pegala en la extensión Chrome → ⚙ Config

## Probar localmente

```bash
npm install
npm start
```

Test:
```bash
curl -X POST http://localhost:3000/consultar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"patente","valor":"AB123CD","sitios":["caba","pba"]}'
```
