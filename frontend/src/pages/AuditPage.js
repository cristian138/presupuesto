import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { getAuditLogs, getAuditLogsCount } from '../services/api';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Pencil, 
  CreditCard, 
  Trash2, 
  LogIn,
  Mail,
  MessageSquare,
  Clock
} from 'lucide-react';

export const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const limit = 20;

  useEffect(() => {
    fetchLogs();
    fetchCount();
  }, [page, actionFilter, entityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (actionFilter !== 'all') params.action_type = actionFilter;
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      
      const response = await getAuditLogs(params);
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCount = async () => {
    try {
      const params = {};
      if (actionFilter !== 'all') params.action_type = actionFilter;
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      
      const response = await getAuditLogsCount(params);
      setTotalCount(response.data.count);
    } catch (error) {
      console.error('Error fetching count:', error);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      crear: <User size={16} className="text-emerald-600" />,
      editar: <Pencil size={16} className="text-blue-600" />,
      pagar: <CreditCard size={16} className="text-[#002D54]" />,
      eliminar: <Trash2 size={16} className="text-red-600" />,
      login: <LogIn size={16} className="text-slate-600" />,
      email_enviado: <Mail size={16} className="text-amber-600" />,
      whatsapp_enviado: <MessageSquare size={16} className="text-emerald-600" />
    };
    return icons[action] || <Clock size={16} className="text-slate-400" />;
  };

  const getActionLabel = (action) => {
    const labels = {
      crear: 'Creación',
      editar: 'Edición',
      pagar: 'Pago',
      eliminar: 'Eliminación',
      login: 'Inicio de sesión',
      email_enviado: 'Email enviado',
      whatsapp_enviado: 'WhatsApp enviado'
    };
    return labels[action] || action;
  };

  const getEntityLabel = (entity) => {
    const labels = {
      usuario: 'Usuario',
      presupuesto: 'Presupuesto',
      pago: 'Pago',
      sesion: 'Sesión',
      configuracion_notificaciones: 'Configuración'
    };
    return labels[entity] || entity;
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <>
      <Header title="Auditoría" subtitle="Registro de acciones del sistema">
        <div className="flex items-center gap-3">
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo de acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="crear">Creación</SelectItem>
              <SelectItem value="editar">Edición</SelectItem>
              <SelectItem value="pagar">Pago</SelectItem>
              <SelectItem value="eliminar">Eliminación</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="email_enviado">Email enviado</SelectItem>
              <SelectItem value="whatsapp_enviado">WhatsApp enviado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo de entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades</SelectItem>
              <SelectItem value="usuario">Usuario</SelectItem>
              <SelectItem value="presupuesto">Presupuesto</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="sesion">Sesión</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <div className="p-8 animate-fade-in">
        {/* Stats */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {logs.length} de {totalCount} registros
          </p>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No hay registros de auditoría
            </div>
          ) : (
            <div className="divide-y divide-slate-100" data-testid="audit-logs-list">
              {logs.map((log, index) => (
                <div 
                  key={log.id}
                  className="p-4 hover:bg-slate-50/50 transition-colors"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {getActionIcon(log.action_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {log.user_name}
                            <span className="font-normal text-slate-500"> realizó </span>
                            <span className="text-[#002D54]">{getActionLabel(log.action_type)}</span>
                            <span className="font-normal text-slate-500"> en </span>
                            <span className="font-medium">{getEntityLabel(log.entity_type)}</span>
                          </p>
                          {log.details && (
                            <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                          )}
                          {log.monthly_period && (
                            <p className="text-sm text-slate-500 mt-1">
                              Período: <span className="font-mono">{log.monthly_period}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-mono text-slate-500">
                            {new Date(log.timestamp).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            IP: {log.ip_address}
                          </p>
                        </div>
                      </div>
                      
                      {(log.previous_values || log.new_values) && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-sm text-xs font-mono">
                          {log.previous_values && (
                            <div className="mb-2">
                              <span className="text-red-600">- Anterior:</span>
                              <pre className="text-slate-600 overflow-x-auto">
                                {JSON.stringify(log.previous_values, null, 2).substring(0, 200)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div>
                              <span className="text-emerald-600">+ Nuevo:</span>
                              <pre className="text-slate-600 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2).substring(0, 200)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="prev-page-btn"
              >
                <ChevronLeft size={16} />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="next-page-btn"
              >
                Siguiente
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
