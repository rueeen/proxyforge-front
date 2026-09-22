# ProxyForge Frontend

Interfaz local de ProxyForge para importar listas de Magic: The Gathering, resolver sus cartas mediante el backend y generar arte alternativo.

## Requisitos

- Node.js 18 o superior
- El repositorio `proxyforge-back` ejecutándose en `http://localhost:8000`
- CORS habilitado en el backend para `http://localhost:5173`

## Instalación

```bash
npm install
cp .env.example .env
```

La variable disponible es:

```env
VITE_API_URL=http://localhost:8000/api
```

Modifica `VITE_API_URL` si la API se sirve desde otra dirección.

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173`. El backend debe estar corriendo en `localhost:8000` y permitir CORS desde `localhost:5173`.

## Compilar para producción

```bash
npm run build
```
