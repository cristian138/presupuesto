#!/bin/bash
# =============================================================
# Script de Actualización - Sistema de Talento Humano
# Para integración con Sistema de Presupuesto
# =============================================================

echo "=============================================="
echo " Actualizando Sistema de Talento Humano"
echo " Integración con Presupuesto"
echo "=============================================="

# Directorio de la aplicación
APP_DIR="/var/www/jotuns-th"

# Ir al directorio de la aplicación
cd $APP_DIR || exit 1

echo ""
echo "[1/6] Obteniendo últimos cambios del repositorio..."
sudo -u www-data git pull origin main

echo ""
echo "[2/6] Actualizando dependencias del backend..."
cd backend
source venv/bin/activate
pip install httpx --quiet  # Nueva dependencia para webhooks
pip install -r requirements.txt --quiet

echo ""
echo "[3/6] Reiniciando backend..."
sudo supervisorctl restart jotuns-backend

echo ""
echo "[4/6] Esperando que el backend inicie..."
sleep 5

echo ""
echo "[5/6] Verificando que el backend esté funcionando..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/api/health)
if [ "$HEALTH_CHECK" == "200" ]; then
    echo "✓ Backend funcionando correctamente"
else
    echo "✗ Error: Backend no responde (HTTP $HEALTH_CHECK)"
    echo "  Revisa los logs: sudo tail -50 /var/log/supervisor/jotuns-backend.err.log"
    exit 1
fi

echo ""
echo "[6/6] Verificando nuevo endpoint de webhook..."
WEBHOOK_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8002/api/webhook/presupuesto -H "Content-Type: application/json" -d '{"source":"test","event_type":"test","payment_id":"test"}')
if [ "$WEBHOOK_CHECK" == "400" ] || [ "$WEBHOOK_CHECK" == "422" ]; then
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
echo "1. Actualiza el sistema de Presupuesto con el script correspondiente"
echo "2. Prueba el flujo completo aprobando una cuenta de cobro"
echo ""
echo "Para ver logs en tiempo real:"
echo "  sudo tail -f /var/log/supervisor/jotuns-backend.out.log"
echo ""
