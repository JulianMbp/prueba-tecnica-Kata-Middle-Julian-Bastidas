# Guión de Pruebas de Humo

Guía paso a paso para validar manualmente que el sistema funciona. El monorepo está en la carpeta `aprover/` (desde la raíz del repositorio: `cd aprover`).

## Preparación

- Sistema corriendo: `docker-compose up --build` (desde `aprover/`)
- Postman o `curl` disponible
- Variable de entorno: `BASE_URL=http://localhost:3000`
- `.env` configurado (GitHub token, SMTP si se comprueban correos). Las credenciales de login deben coincidir con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del seed.

En los ejemplos, sustituye `TOKEN` por el valor de `access_token` devuelto por el login.

---

## Escenario 1 — Login y autenticación

**Paso 1:** `POST /api/auth/login` con credenciales correctas → **200** y cuerpo con `access_token`.

```bash
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"Admin123!"}'
```

**Paso 2:** `POST /api/auth/login` con contraseña incorrecta → **401**.

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"incorrecta"}'
```

**Paso 3:** `GET /api/releases` sin cabecera `Authorization` → **401**.

```bash
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/releases"
```

**Resultado esperado:** JWT funcional; endpoints protegidos exigen `Bearer`.

---

## Escenario 2 — Release `rs` aprobado automáticamente

**Paso 1:** `POST /api/releases` con `Authorization: Bearer TOKEN`, cuerpo mínimo alineado con la regla:

- `tipo`: `rs`
- `prIdentifier`: `JulianMbp/rpeo-prueba-ci/1` (el PR debe existir y el token GitHub debe tener acceso)
- `cobertura`: `90.9`
- `stack`: `[{"framework":"angular","version":"17.3.1"}]`
- `descripcion`: texto no vacío
- `fecha`, `equipo`, `approverEmail`: valores válidos según DTO

```bash
curl -s -X POST "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha":"2026-04-19",
    "equipo":"Equipo PoC",
    "tipo":"rs",
    "descripcion":"Release validado por reglas",
    "prIdentifier":"JulianMbp/rpeo-prueba-ci/1",
    "cobertura":90.9,
    "stack":[{"framework":"angular","version":"17.3.1"}],
    "approverEmail":"admin@empresa.com"
  }'
```

**Resultado esperado:** respuesta con `estado: "approved"` y `aprobacionAutomatica: true`.

**Correo:** no debe enviarse notificación al `approverEmail` cuando el estado final es `approved` (el servicio solo notifica si queda `pending`).

---

## Escenario 3 — Release `rs` pendiente por cobertura

**Paso 1:** `POST /api/releases` con `tipo=rs`, `cobertura=70`, y el resto de campos válidos para no fallar solo por PR/stack (por ejemplo `prIdentifier` tipo JIRA y stack soportado).

```bash
curl -s -X POST "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha":"2026-04-19",
    "equipo":"Equipo PoC",
    "tipo":"rs",
    "descripcion":"Cobertura bajo umbral",
    "prIdentifier":"JIRA-100",
    "cobertura":70,
    "stack":[{"framework":"angular","version":"17.3.1"}],
    "approverEmail":"TU_CORREO_PARA_SMTP@dominio.com"
  }'
```

**Resultado esperado:** `estado: "pending"`, `aprobacionAutomatica: false`.

**Verificar (si SMTP está configurado):** correo al `approverEmail` cuyo cuerpo incluye el motivo de cobertura, en la línea del backend: *Cobertura insuficiente: … (mínimo 80%)*.

---

## Escenario 4 — Release `rs` pendiente por PR inexistente

**Paso 1:** `POST /api/releases` con `prIdentifier=JulianMbp/rpeo-prueba-ci/999999` y cobertura/stack válidos para aislar el fallo del PR.

```bash
curl -s -X POST "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha":"2026-04-19",
    "equipo":"Equipo PoC",
    "tipo":"rs",
    "descripcion":"PR inexistente",
    "prIdentifier":"JulianMbp/rpeo-prueba-ci/999999",
    "cobertura":90,
    "stack":[{"framework":"angular","version":"17.3.1"}],
    "approverEmail":"TU_CORREO_PARA_SMTP@dominio.com"
  }'
```

**Resultado esperado:** `estado: "pending"`.

**Verificar:** correo con motivo que indique que el PR no fue encontrado (texto del backend: *PR no encontrado en GitHub (o el token no tiene acceso al repositorio)*).

---

## Escenario 5 — Release `rs` pendiente por framework obsoleto

**Paso 1:** `POST /api/releases` con `stack=[{"framework":"angular","version":"13.0.0"}]`, cobertura y PR/JIRA válidos.

```bash
curl -s -X POST "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha":"2026-04-19",
    "equipo":"Equipo PoC",
    "tipo":"rs",
    "descripcion":"Stack obsoleto",
    "prIdentifier":"JIRA-200",
    "cobertura":90,
    "stack":[{"framework":"angular","version":"13.0.0"}],
    "approverEmail":"TU_CORREO_PARA_SMTP@dominio.com"
  }'
```

**Resultado esperado:** `estado: "pending"`.

**Verificar:** correo con motivo que mencione frameworks no soportados (texto del backend: *Uno o más frameworks no están en las últimas 4 versiones soportadas*).

---

## Escenario 6 — Release `fx` (sin evaluación)

**Paso 1:** `POST /api/releases` con `tipo=fx`, `cobertura=10` (u otro valor); no se llama al `rules-service`.

```bash
curl -s -X POST "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha":"2026-04-19",
    "equipo":"Equipo PoC",
    "tipo":"fx",
    "descripcion":"Hotfix sin evaluación de reglas",
    "cobertura":10,
    "stack":[{"framework":"angular","version":"17.3.1"}],
    "approverEmail":"admin@empresa.com"
  }'
```

**Resultado esperado:** `estado: "approved"`, `aprobacionAutomatica: false`.

---

## Escenario 7 — Aprobación manual desde admin

**Paso 1:** Copia el `id` de un release en estado `pending` (por ejemplo de los escenarios 3–5). `PATCH /api/releases/{id}/approve` con token de **admin**.

```bash
curl -s -X PATCH "$BASE_URL/api/releases/ID_DEL_RELEASE_PENDING/approve" \
  -H "Authorization: Bearer TOKEN_ADMIN" \
  -H "Content-Type: application/json"
```

**Resultado esperado:** `estado: "approved"`, `aprobacionAutomatica: false`.

**Paso 2:** Repetir con un JWT cuyo usuario tenga rol **approver** (no admin) → **403**.

> **Nota:** el seed inicial solo crea un usuario **admin**. Para probar el 403 hace falta un segundo usuario con `role: 'approver'` en la tabla `users` (por ejemplo insertando en SQLite tras generar el hash con bcrypt) o ampliando el seed en desarrollo.

---

## Escenario 8 — Listar todas las solicitudes

**Paso 1:** `GET /api/releases` con `Authorization: Bearer TOKEN` → array con todos los releases, sin filtros en backend.

```bash
curl -s "$BASE_URL/api/releases" \
  -H "Authorization: Bearer TOKEN"
```

**Verificar en el frontend:** [http://localhost:4200/releases](http://localhost:4200/releases) (listado coherente con el mismo usuario autenticado).
