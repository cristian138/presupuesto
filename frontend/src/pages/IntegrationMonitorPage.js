import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Send,
  Wifi,
  WifiOff,
  ArrowRightLeft,
  FileText
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function IntegrationMonitorPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(null);
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/api/integration/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/integration/health`)
      ]);
      
      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el estado de la integración",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const notifyTH = async (paymentId) => {
    setNotifying(paymentId);
    try {
      const response = await fetch(`${API_URL}/api/integration/notify-th/${paymentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Notificación enviada a Talento Humano"
        });
        fetchStatus();
      } else {
        toast({
          title: "Error",
          description: data.detail || "No se pudo enviar la notificación",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al enviar notificación",
        variant: "destructive"
      });
    } finally {
      setNotifying(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh cada 30 segundos
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('es-CO');
  };

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(value * 1000); // Convertir de miles a pesos
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitor de Integración</h1>
          <p className="text-gray-500">Cuentas de cobro recibidas desde Talento Humano</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(status?.th_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ir a Talento Humano
          </Button>
          <Button onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estado de Conexión */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Estado de Conexión con Talento Humano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {health?.th_reachable ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <Wifi className="h-5 w-5" />
                  <span className="font-medium">Conectado</span>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {health?.response_time_ms?.toFixed(0)}ms
                </Badge>
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <WifiOff className="h-5 w-5" />
                <span className="font-medium">Sin conexión</span>
                <span className="text-sm text-gray-500">({health?.message})</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Recibidos de TH</p>
                <p className="text-2xl font-bold">{status?.total_from_th || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pendiente Pago</p>
                <p className="text-2xl font-bold text-yellow-600">{status?.pending_payment_count || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pagados</p>
                <p className="text-2xl font-bold text-blue-600">{status?.paid_count || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Notificados a TH</p>
                <p className="text-2xl font-bold text-green-600">{status?.notified_th_count || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Send className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pendientes de Pago */}
      {status?.pending_payment?.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
              <Clock className="h-5 w-5" />
              Cuentas de Cobro Pendientes de Pago
            </CardTitle>
            <CardDescription>
              Estas cuentas de cobro están esperando que registres el pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Concepto</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="text-left py-2 px-2">Responsable</th>
                    <th className="text-left py-2 px-2">Recibido</th>
                    <th className="text-center py-2 px-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {status.pending_payment.map((budget) => (
                    <tr key={budget.id} className="border-b hover:bg-yellow-50">
                      <td className="py-2 px-2 font-medium">{budget.concept}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(budget.monthly_value)}</td>
                      <td className="py-2 px-2 text-gray-500">{budget.responsible_name}</td>
                      <td className="py-2 px-2 text-gray-500">{formatDate(budget.created_at)}</td>
                      <td className="py-2 px-2 text-center">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.location.href = `/monthly?budget=${budget.id}`}
                        >
                          Registrar Pago
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagados pero NO notificados */}
      {status?.paid?.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
              <Send className="h-5 w-5" />
              Pagados - Pendiente Notificar a TH
            </CardTitle>
            <CardDescription>
              Estos pagos necesitan que envíes el soporte a Talento Humano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.paid.map((budget) => (
                <div key={budget.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="space-y-1">
                    <p className="font-medium">{budget.concept}</p>
                    <p className="text-sm text-gray-500">Pagado: {formatDate(budget.payment_date)}</p>
                    <p className="text-sm font-medium">{formatCurrency(budget.paid_value / 1000)}</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => notifyTH(budget.payment_id)}
                    disabled={notifying === budget.payment_id}
                  >
                    {notifying === budget.payment_id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Enviar a TH
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notificados a TH */}
      {status?.notified_th?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Completados - Notificados a TH
            </CardTitle>
            <CardDescription>
              Estos pagos ya fueron procesados y el soporte fue enviado a Talento Humano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Concepto</th>
                    <th className="text-right py-2 px-2">Valor Pagado</th>
                    <th className="text-left py-2 px-2">Fecha Pago</th>
                    <th className="text-left py-2 px-2">Notificado</th>
                    <th className="text-center py-2 px-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {status.notified_th.slice(0, 10).map((budget) => (
                    <tr key={budget.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium">{budget.concept}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(budget.paid_value / 1000)}</td>
                      <td className="py-2 px-2 text-gray-500">{formatDate(budget.payment_date)}</td>
                      <td className="py-2 px-2 text-gray-500">{formatDate(budget.th_notified_at)}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Completado
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Flujo de Integración</h3>
              <p className="text-sm text-blue-700 mt-1">
                1. TH aprueba cuenta de cobro → 2. Se crea presupuesto aquí automáticamente → 
                3. Registras el pago → 4. El soporte se envía automáticamente a TH
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Los pagos se notifican automáticamente a TH al registrarlos. 
                Si falla, puedes enviar manualmente desde esta pantalla.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
