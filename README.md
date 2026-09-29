# Stockea Extended

Portal web de inventario que se conecta a **Hildra Core** como backend. Replica las funciones principales de Stockea (productos, inventario, movimientos) usando la API REST del módulo Stockea de la plataforma Hildra.

## Requisitos

- [Node.js](https://nodejs.org/) 20+
- [Hildra Core](https://github.com/hildra/hildra-core) corriendo en `http://localhost:8080`

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Levantar Hildra Core (en otro terminal)
cd ../hildra-core
docker compose up -d

# 4. Iniciar el portal
npm run dev
```

El portal abre en **http://localhost:5174**.

## Autenticación

El portal usa la identidad de Hildra Core:

1. Registra un usuario en Hildra Core o usa uno existente
2. Inicia sesión con email y contraseña
3. Selecciona la organización activa (si tienes varias)

```bash
# Crear usuario de prueba en Hildra Core
curl -X POST http://localhost:8080/api/v1/identity/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@stockea.com","password":"securepass123","first_name":"Admin","last_name":"Stockea"}'
```

## Acceso al inventario

El inventario de Stockea está disponible cuando se cumple **alguna** de estas condiciones:

1. El usuario tiene permisos explícitos de Stockea (`stockea:products:read`, etc.)
2. La organización tiene instalada la app **Costea** en Hildra Core
3. La organización tiene instalada la app **Stockea** en Hildra Core

Los usuarios de Costea pueden gestionar inventario sin instalar Stockea por separado. El portal consulta las apps instaladas vía `GET /api/v1/applications/organizations/:orgId/installed`.

### Acceso desde Costea Extended

Costea abre el portal con handoff de sesión en `/auth/handoff#token=...&refresh=...`. Configura `EXPO_PUBLIC_STOCKEA_URL` en Costea apuntando a este portal.

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Resumen de inventario, productos activos, stock bajo, valor total |
| **Productos** | CRUD de productos con SKU, categoría, precios y stock mínimo |
| **Inventario** | Vista de stock con alertas y registro de movimientos |
| **Movimientos** | Historial de entradas, salidas y ajustes |

## Sincronización web ↔ móvil

Este portal y la app móvil `stockea_extended` (modo Extended) comparten la misma API en Hildra. Los cambios en uno se reflejan en el otro con pull cada 30 segundos y al volver a la pestaña o app.

## API de Hildra Core

El portal consume estos endpoints:

```
POST /api/v1/identity/auth/login
GET  /api/v1/identity/auth/me
GET  /api/v1/organizations
GET  /api/v1/stockea/organizations/:orgId/summary
GET  /api/v1/stockea/organizations/:orgId/products
POST /api/v1/stockea/organizations/:orgId/products
POST /api/v1/stockea/organizations/:orgId/products/:id/movements
GET  /api/v1/stockea/organizations/:orgId/movements
```

## Estructura

```
src/
├── api/           # Cliente HTTP para Hildra Core
├── auth/          # Contexto de sesión y tokens
├── components/    # Layout, Modal, ProtectedRoute
├── pages/         # Dashboard, Productos, Inventario, Movimientos
├── types/         # Tipos TypeScript
└── utils/         # Formateo de moneda, fechas, badges
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080/api/v1` | URL base de Hildra Core |

## Build para producción

```bash
npm run build
npm run preview
```

Los archivos estáticos quedan en `dist/`.
