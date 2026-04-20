#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════"
echo "  Ejecutando tests de todos los servicios"
echo "═══════════════════════════════════════"
echo "  Raíz del proyecto: $PROJECT_ROOT"

SERVICES=("rules-service" "release-service" "integration-service" "notification-service" "api-gateway")
FAILED=()

for SERVICE in "${SERVICES[@]}"; do
  echo ""
  echo "▶ Testing $SERVICE..."

  if [ ! -d "apps/$SERVICE" ]; then
    echo "❌ $SERVICE — carpeta apps/$SERVICE no existe"
    FAILED+=("$SERVICE")
    continue
  fi

  if ( cd "apps/$SERVICE" && npm test -- --coverage --passWithNoTests 2>&1 ); then
    echo "✅ $SERVICE — OK"
  else
    echo "❌ $SERVICE — FALLÓ"
    FAILED+=("$SERVICE")
  fi
done

echo ""
echo "═══════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✅ Todos los servicios pasaron los tests"
else
  echo "❌ Servicios con errores: ${FAILED[*]}"
  exit 1
fi
