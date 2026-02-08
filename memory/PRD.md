# Sistema de Control Presupuestal - PRD

## Problema Original
Sistema web administrativo que permite el control integral de gastos presupuestados frente a gastos realmente ejecutados, con enfoque en gestión mensual, validación de pagos, roles de usuario, auditoría inalterable, notificaciones automáticas por WhatsApp y correo electrónico, y generación de soportes en PDF.

## Arquitectura

### Backend
- **Framework**: FastAPI (Python)
- **Base de datos**: MongoDB
- **Autenticación**: JWT
- **Integraciones**:
  - TextMeBot API (WhatsApp)
  - SMTP Office 365 (Email)
  - ReportLab + QRCode (PDF generation)

### Frontend
- **Framework**: React 19
- **UI Components**: Shadcn/UI + Tailwind CSS
- **Charts**: Recharts
- **Exports**: jspdf, xlsx

## User Personas

### Super Administrador
- Administración total del sistema
- Creación/modificación de presupuestos
- Gestión de usuarios
- Configuración de notificaciones
- Acceso a auditoría completa

### Usuario Contable
- Registro de pagos mensuales
- Consulta de presupuestos
- Generación de reportes
- Sin acceso a configuraciones críticas ni auditoría

## Requisitos Core (Estáticos)

1. **Módulo de Presupuestos**
   - Registro con tipo de gasto (fijo/variable/ocasional)
   - Descomposición automática en períodos mensuales
   - Seguimiento de responsables

2. **Consulta Mensual**
   - Filtro por mes/año
   - Estados: Pendiente, Pagado, Con Diferencia, Vencido
   - KPIs financieros

3. **Ejecución del Gasto**
   - Registro de pagos con fecha, valor, método
   - Validación de duplicidad por mes
   - Cálculo de variaciones

4. **Notificaciones**
   - WhatsApp vía TextMeBot API
   - Email vía SMTP Office 365
   - Configuración de eventos disparadores

5. **PDFs**
   - Código QR de verificación
   - Firma visual del sistema
   - Adjunto automático en emails

6. **Auditoría**
   - Registro inalterable de acciones
   - IP, usuario, timestamp
   - Valores anteriores y nuevos

## Lo Implementado (2026-02-08)

### Backend
- [x] Auth endpoints (register, login, me)
- [x] CRUD de presupuestos con auto-generación mensual
- [x] Endpoints de presupuestos mensuales
- [x] Registro de pagos con PDF
- [x] Dashboard KPIs y resumen mensual
- [x] Gestión de usuarios
- [x] Auditoría completa
- [x] Configuración de notificaciones
- [x] Integración TextMeBot (WhatsApp)
- [x] Integración SMTP Office 365
- [x] Generación de PDF con QR

### Frontend
- [x] Login/Register con branding corporativo
- [x] Dashboard con KPIs y gráfico de barras
- [x] Gestión de presupuestos (CRUD)
- [x] Vista mensual con filtros
- [x] Registro de pagos con preview PDF
- [x] Reportes PDF/Excel
- [x] Gestión de usuarios
- [x] Módulo de auditoría (timeline)
- [x] Configuración de notificaciones
- [x] Sidebar persistente
- [x] Diseño corporativo (#002D54)

## Backlog Priorizado

### P0 (Crítico)
- ✅ Completado MVP

### P1 (Alta Prioridad)
- [ ] Scheduler automático para verificar vencimientos y enviar alertas
- [ ] Upload de archivos de soporte de pago
- [ ] Recuperación de contraseña por email

### P2 (Media Prioridad)
- [ ] Exportación de reportes acumulados por rango de fechas
- [ ] Gráficos adicionales (tendencias, pie charts)
- [ ] Filtro por tipo de gasto en vistas

### P3 (Baja Prioridad)
- [ ] Módulo de ingresos (preparado en arquitectura)
- [ ] Dashboard comparativo año vs año
- [ ] Integración con calendario externo

## Próximas Tareas

1. **Notificaciones automáticas**: Implementar APScheduler para enviar alertas automáticas N días antes del vencimiento
2. **Soporte de archivos**: Permitir adjuntar comprobantes de pago (imágenes/PDFs)
3. **Mejora de reportes**: Agregar más opciones de filtrado y rangos de fechas personalizados

## Credenciales Configuradas

- TextMeBot API Key: Configurada en backend/.env
- SMTP Office 365: Configurado con servidor smtp.office365.com:587
