# Arquitectura — Release Approval System

Documento de referencia del monorepo (PoC **v3 — sin librería compartida**). El código vive en `aprover/`.

**Stack:** NestJS (monorepo) + Angular + Tailwind CSS + SQLite + Docker Compose + JWT.

---

## Microservicios y responsabilidades

| Servicio | Puerto | Responsabilidad |
|----------|--------|-----------------|
| **frontend** | 4200 (host; contenedor sirve en 80) | SPA Angular: login, alta y listado de releases, panel admin (reglas, aprobaciones). |
| **api-gateway** | 3000 | Entrada HTTP única hacia el cliente: CORS, Swagger (`/docs`), `ValidationPipe`, JWT (`JwtAuthGuard`), rate limiting en login, proxy a release-service e integration-service (coverage). Rutas que requieren rol `admin` usan `RolesGuard`. |
| **release-service** | 3001 | Persistencia SQLite (TypeORM): usuarios, releases, reglas de aprobación. Login (`bcrypt` + JWT), seed inicial, **ReleaseManager** que orquesta evaluación (`rs`) o bypass (`fx`/`cv`), envío de notificaciones si queda `pending`. |
| **rules-service** | 3002 | Motor de reglas: `min_coverage`, validación de `prIdentifier` (GitHub vía integration-service o texto tipo JIRA), `check_obsolescence` contra `supported-versions.json`. Expone `POST /rules/evaluate`. |
| **integration-service** | 3003 | Octokit: validación de existencia de PR, extracción de cobertura desde check runs / comentarios de PR. **Framework Version Explorer**: comprobación de stack contra versiones soportadas (usado por reglas indirectamente). |
| **notification-service** | 3004 | Envío de correos con Nodemailer (SMTP Gmail) cuando un release queda en `pending`. |

**Comunicación:** el navegador solo habla con **api-gateway**. El gateway reenvía a **release-service**; el **release-service** llama a **rules-service** y **notification-service**; el **rules-service** llama a **integration-service** cuando el identificador tiene formato de PR de GitHub.

---

## Mapa diagrama conceptual → implementación

| Componente conceptual | Implementación |
|----------------------|----------------|
| Release FrontEnd | Angular — `/releases` (crear + listar) |
| Release Administration | Angular — `/admin` (aprobar, gestionar reglas) |
| Release Core Service | NestJS `release-service` puerto 3001 |
| Notification Service | NestJS `notification-service` puerto 3004 |
| Release Rule Service | NestJS `rules-service` puerto 3002 |
| Framework Version Explorer | Endpoints en `integration-service` puerto 3003 |
| GitHub API | Octokit dentro de `integration-service` |
| Release Manager | Clase `ReleaseManager` en `release-service` |
| Release Approval Rules | Tabla `approval_rules` en SQLite |
| Releases | Tabla `releases` en SQLite |

---

## Diagrama oficial (referencia)

```
Release Approval Request
│
├── Release FrontEnd
├── Framework Version Explorer ◄─────────┐
├── GitHub API               ◄─────────┐ │
│                                      │ │
│   ┌── Automatic Release Approval ────┼─┼──────────────┐
│   │   Release Core Service ──────────┘ │              │
│   │   Notification Service             │              │
│   │   Release Rule Service ────────────┘              │
│   └───────────────────────────────────────────────────┘
│
├── Release Administration
│         │
│         ▼
│   Release Manager ◄──── Release Approval Rules (DB)
│         │
│         ▼
│      Releases (DB)
```

---

## Flujo de negocio completo

```
[Angular] POST /api/releases + JWT
        ↓
[API Gateway] valida JWT → proxy
        ↓
[Release Core Service]
        ↓
  guarda Release (pending)
        ↓
  [Release Manager]
        ├── fx|cv → approved, aprobacionAutomatica=false → FIN
        └── rs → lee ApprovalRules activas
                    ↓
              POST rules-service/rules/evaluate
                    ↓
              ┌─── PASS → approved, aprobacionAutomatica=true
              └─── FAIL → pending
                            ↓
                    POST notification-service/notifications/email
                    (Nodemailer → Gmail SMTP)
```

---

## Decisiones de arquitectura

1. **Microservicios autónomos**  
   Cada servicio define sus propios DTOs, interfaces y modelos. Si dos servicios necesitan una estructura parecida, se **duplica** a propósito para que un cambio local no rompa contratos ajenos.

2. **Sin `libs/shared/`**  
   No hay paquete de dominio compartido en el monorepo; el acoplamiento se limita a contratos HTTP y payloads documentados (Swagger en el gateway).

3. **SQLite en release-service**  
   PoC con un solo proceso de escritura y despliegue sencillo; el fichero se monta por volumen en Docker.

4. **API Gateway como único borde**  
   El frontend no conoce URLs internas de microservicios; solo `api-gateway` + rutas `/api/*`.

5. **Reglas externalizadas en rules-service**  
   El motor de negocio no está embebido en el CRUD de releases; facilita testear reglas y cambiar políticas sin tocar el core de persistencia.

---

## Modelo de datos (entidades en release-service)

### `Release`

| Campo | Tipo / valores |
|-------|----------------|
| `id` | UUID |
| `fecha` | `Date` |
| `equipo` | string |
| `tipo` | `'rs' \| 'fx' \| 'cv'` |
| `descripcion` | string |
| `prIdentifier` | string opcional |
| `cobertura` | number (0–100) |
| `stack` | `{ framework, version }[]` (JSON) |
| `estado` | `'approved' \| 'pending' \| 'rejected'` |
| `aprobacionAutomatica` | boolean |
| `motivoRechazo` | string opcional |
| `approverEmail` | string |
| `createdAt` / `updatedAt` | timestamps |

### `ApprovalRule`

| Campo | Descripción |
|-------|-------------|
| `id` | entero |
| `nombre` | `'min_coverage' \| 'require_pr' \| 'check_obsolescence'` |
| `descripcion` | string |
| `activa` | boolean |
| `config` | JSON (p. ej. `{ minCoverage: 80 }`) |
| `updatedAt` | timestamp |

### `User`

| Campo | Descripción |
|-------|-------------|
| `id` | UUID |
| `email` | único |
| `password` | hash bcrypt |
| `role` | `'admin' \| 'approver'` |
| `equipo` | string |

---

## Autenticación JWT

```
POST /api/auth/login → api-gateway → release-service /auth/login
  bcrypt.compare → jwtService.sign({ sub, email, role })
  → { access_token, user }

Roles:
  approver — crear releases, ver listado
  admin    — todo + aprobar manual + gestionar ApprovalRules

Guards en api-gateway:
  JwtAuthGuard — verifica Bearer token
  RolesGuard   — verifica role del payload JWT
```

---

## Estructura del monorepo (`aprover/`)

```
aprover/
├── docker-compose.yml
├── .env / .env.example
├── scripts/
│   └── run-all-tests.sh
└── apps/
    ├── api-gateway/
    │   └── src/
    │       ├── dto/
    │       ├── auth/
    │       └── gateway/
    ├── release-service/
    │   └── src/
    │       ├── dto/
    │       ├── entities/
    │       ├── auth/
    │       ├── release/
    │       ├── rules-config/
    │       └── seed/
    ├── rules-service/
    │   └── src/
    │       ├── dto/
    │       └── rules/
    ├── integration-service/
    │   └── src/
    │       ├── dto/
    │       ├── github/
    │       └── frameworks/
    ├── notification-service/
    │   └── src/
    │       ├── dto/
    │       └── notification/
    └── frontend/
        └── src/app/
            ├── core/
            ├── features/
            └── shared/
```

---

## Contratos de DTOs (resumen)

Cada servicio es dueño de los suyos; el gateway replica el contrato del cliente (`CreateReleaseDto`, `LoginDto`, etc.).

- **api-gateway:** `CreateReleaseDto`, `LoginDto`, `UpdateRuleDto`, …
- **release-service:** `CreateReleaseDto`, respuestas de evaluación y notificación, auth.
- **rules-service:** `EvaluateRulesDto` / `EvaluateRulesResponseDto`.
- **integration-service:** DTOs de cobertura, frameworks y validación de PR.
- **notification-service:** `SendEmailDto` (o equivalente) para el cuerpo del correo.

---

## Variables de entorno

Valores de ejemplo; en Docker las URLs internas usan nombres de servicio (`http://release-service:3001`, etc.).

| Variable | Uso |
|----------|-----|
| `JWT_SECRET` | Firma y verificación de JWT (gateway + release-service). |
| `JWT_EXPIRY` | Caducidad del token (p. ej. `24h`). |
| `DB_PATH` | Ruta del fichero SQLite en release-service. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usuario admin del seed (solo si la BD está vacía). |
| `GITHUB_TOKEN` | PAT para integration-service (PRs y checks). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP (Gmail con app password). |
| `RELEASE_SERVICE_URL` | URL base del release-service (consumida por gateway). |
| `RULES_SERVICE_URL` | URL del rules-service (release-service). |
| `INTEGRATION_SERVICE_URL` | URL del integration-service (gateway para coverage; rules-service para validar PRs). |
| `NOTIFICATION_SERVICE_URL` | URL del notification-service (release-service). |

Ejemplo de bloque `.env` (referencia):

```env
JWT_SECRET=cambiar_en_produccion
JWT_EXPIRY=24h
DB_PATH=./data/releases.db
GITHUB_TOKEN=ghp_xxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
RELEASE_SERVICE_URL=http://release-service:3001
RULES_SERVICE_URL=http://rules-service:3002
INTEGRATION_SERVICE_URL=http://integration-service:3003
NOTIFICATION_SERVICE_URL=http://notification-service:3004
ADMIN_EMAIL=admin@empresa.com
ADMIN_PASSWORD=Admin123!
```

---

## Seed inicial

- **Usuario admin:** email y contraseña desde `ADMIN_EMAIL` / `ADMIN_PASSWORD` (hash bcrypt, salt 12).
- **Reglas por defecto:**

```json
[
  { "nombre": "min_coverage",       "activa": true, "config": { "minCoverage": 80 } },
  { "nombre": "require_pr",         "activa": true, "config": {} },
  { "nombre": "check_obsolescence", "activa": true, "config": {} }
]
```

---

## Frontend — rutas

| Ruta | Componente | Acceso |
|------|------------|--------|
| `/login` | Login | público |
| `/releases` | Listado | `AuthGuard` |
| `/releases/new` | Formulario | `AuthGuard` |
| `/admin` | Dashboard admin | `AdminGuard` |
| `/admin/releases` | Aprobaciones | `AdminGuard` |
| `/admin/rules` | Reglas | `AdminGuard` |

---

## Referencia

Este documento condensa y ordena el contenido técnico del informe de la PoC (`INFORME.md` en la raíz del repositorio).
