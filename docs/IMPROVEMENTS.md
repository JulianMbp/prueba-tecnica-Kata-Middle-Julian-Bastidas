# Propuestas de Mejora al Proceso y Seguridad

## Mejoras al proceso y flujo

### 1. Webhooks de GitHub

**Descripción:** detectar PRs automáticamente al abrirse sin formulario manual.

**Impacto:** elimina fricción del desarrollador, aprobación proactiva.

**Implementación:** endpoint `POST /webhooks/github` que recibe eventos de GitHub.

### 2. Integración real con JIRA

**Descripción:** validar que la historia JIRA existe y está en estado "Ready for Deploy".

**Impacto:** garantiza trazabilidad completa entre código y requerimiento.

**Implementación:** JIRA REST API con token de servicio.

### 3. Aprobación por email (link de un solo uso)

**Descripción:** el correo al aprobador incluye un link que aprueba con un click.

**Impacto:** reduce el tiempo de aprobación manual de horas a minutos.

**Implementación:** token UUID de un solo uso guardado en DB con expiración.

### 4. Dashboard de métricas

**Descripción:** tasa de aprobación automática por equipo, tiempo promedio de resolución.

**Impacto:** visibilidad del estado de madurez de cada equipo.

**Implementación:** endpoint de agregación + gráficas en el frontend.

### 5. Notificaciones en Slack

**Descripción:** además del correo, notificar al canal del equipo vía webhook.

**Impacto:** mayor visibilidad sin depender de que el aprobador revise el correo.

**Implementación:** Slack Incoming Webhooks (gratuito).

## Mejoras de seguridad

### Implementadas en la PoC

- JWT con roles (approver / admin)
- bcrypt para passwords (salt: 12)
- Rate limiting en `/auth/login` (5 intentos/minuto con `@nestjs/throttler`)
- CORS estricto solo para el origen del frontend
- ValidationPipe global con class-validator en todos los DTOs
- Guards en Angular (AuthGuard + AdminGuard)

### Propuestas para producción

- mTLS entre microservicios internos (actualmente HTTP plano en red Docker)
- Secrets management con HashiCorp Vault o AWS Secrets Manager
- Audit log inmutable de todas las acciones de aprobación
- 2FA para usuarios con rol admin
- Refresh tokens con rotación automática
- Helmet.js para headers de seguridad HTTP
