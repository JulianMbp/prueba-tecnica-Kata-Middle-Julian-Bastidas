#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════"
echo "  Instalando dependencias de todos los servicios"
echo "═══════════════════════════════════════"
echo "  Raíz del proyecto: $PROJECT_ROOT"

SERVICES=("rules-service" "release-service" "integration-service" "notification-service" "api-gateway" "frontend")
FAILED=()

for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "▶ Instalando dependencias en $SERVICE..."

  if [ ! -d "apps/$SERVICE" ]; then
    echo "⚠ $SERVICE — carpeta apps/$SERVICE no existe, saltando"
    continue
  fi

  if ( cd "apps/$SERVICE" && npm install 2>&1 ); then
    echo "✅ $SERVICE — dependencias instaladas"
  else
    echo "❌ $SERVICE — fallo al instalar"
    FAILED+=("$SERVICE")
  fi
done

echo ""
echo "═══════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✅ Dependencias instaladas en todos los servicios"
else
  echo "❌ Servicios con errores de instalación: ${FAILED[*]}"
  exit 1
fi
