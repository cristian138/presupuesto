#!/bin/bash
# =============================================================
# Script de Actualización - Sistema de Presupuesto
# Para integración con Sistema de Talento Humano
# =============================================================

echo "=============================================="
echo " Actualizando Sistema de Presupuesto"
echo " Integración con Talento Humano"
echo "=============================================="

# Directorio de la aplicación
APP_DIR="/var/www/presupuesto"

# Ir al directorio de la aplicación
cd $APP_DIR || exit 1

echo ""
echo "[1/6] Obteniendo últimos cambios del repositorio..."
git pull origin main

echo ""
echo "[2/6] Deteniendo contenedores actuales..."
docker-compose down

echo ""
echo "[3/6] Reconstruyendo contenedores..."
docker-compose build --no-cache

echo ""
echo "[4/6] Iniciando contenedores..."
docker-compose up -d

echo ""
echo "[5/6] Esperando que los servicios inicien..."
sleep 10

echo ""
echo "[6/6] Verificando que el backend esté funcionando..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8004/api/auth/check-users)
if [ "$HEALTH_CHECK" == "200" ]; then
    echo "✓ Backend funcionando correctamente"
else
    echo "✗ Error: Backend no responde (HTTP $HEALTH_CHECK)"
    echo "  Revisa los logs: docker-compose logs backend"
    exit 1
fi

echo ""
echo "Verificando nuevo endpoint de webhook..."
WEBHOOK_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8004/api/webhook/talento-humano -H "Content-Type: application/json" -d '{"source":"test","event_type":"test","payment_id":"test","concept":"test","monthly_value":0,"expense_type":"fijo","total_months":1,"start_date":"2026-01-01","end_date":"2026-01-02","responsible_name":"test"}')
if [ "$WEBHOOK_CHECK" == "400" ] || [ "$WEBHOOK_CHECK" == "422" ] || [ "$WEBHOOK_CHECK" == "200" ]; then
    echo "✓ Endpoint webhook configurado correctamente"
else
    echo "⚠ Advertencia: Endpoint webhook puede no estar funcionando (HTTP $WEBHOOK_CHECK)"
fi

echo ""
echo "=============================================="
echo " ✓ Actualización completada exitosamente"
echo "=============================================="
echo ""
echo "Próximos pasos:"
echo "1. Asegúrate de que el sistema de TH también esté actualizado"
echo "2. Verifica que el usuario 'Sharon Alejandra Cardenas Ospina' exista"
echo "3. Prueba el flujo completo aprobando una cuenta de cobro en TH"
echo ""
echo "Para ver logs en tiempo real:"
echo "  docker-compose logs -f backend"
echo ""
