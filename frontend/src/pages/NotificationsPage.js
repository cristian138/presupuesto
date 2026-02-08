import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { getNotificationConfig, updateNotificationConfig, testWhatsApp, testEmail } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Bell, MessageSquare, Mail, Send, Settings, CheckCircle, AlertCircle } from 'lucide-react';

export const NotificationsPage = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await getNotificationConfig();
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationConfig(config);
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      toast.error('Ingrese un número de teléfono');
      return;
    }
    
    setTestingWhatsApp(true);
    try {
      const response = await testWhatsApp(testPhone, 'Mensaje de prueba del Sistema de Control Presupuestal');
      if (response.data.success) {
        toast.success('Mensaje de WhatsApp enviado exitosamente');
      } else {
        toast.error(`Error: ${response.data.error || 'No se pudo enviar el mensaje'}`);
      }
    } catch (error) {
      toast.error('Error al enviar mensaje de WhatsApp');
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('Ingrese un correo electrónico');
      return;
    }
    
    setTestingEmail(true);
    try {
      const response = await testEmail(testEmailAddress);
      if (response.data.success) {
        toast.success('Correo de prueba enviado exitosamente');
      } else {
        toast.error(`Error: ${response.data.error || 'No se pudo enviar el correo'}`);
      }
    } catch (error) {
      toast.error('Error al enviar correo de prueba');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Notificaciones" subtitle="Configuración de alertas automáticas" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Notificaciones" subtitle="Configuración de alertas automáticas">
        <Button 
          onClick={handleSave} 
          className="btn-primary" 
          disabled={saving}
          data-testid="save-config-btn"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
          ) : (
            <Settings size={18} className="mr-2" />
          )}
          Guardar Configuración
        </Button>
      </Header>

      <div className="p-8 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* WhatsApp Configuration */}
          <div className="bg-white border border-slate-200 rounded-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-sm bg-emerald-50 flex items-center justify-center">
                <MessageSquare className="text-emerald-600" size={20} />
              </div>
              <div>
                <h3 className="font-chivo font-bold text-lg text-slate-900">WhatsApp</h3>
                <p className="text-sm text-slate-500">Notificaciones vía TextMeBot</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Habilitar WhatsApp</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enviar notificaciones por WhatsApp
                  </p>
                </div>
                <Switch
                  checked={config?.whatsapp_enabled || false}
                  onCheckedChange={(v) => handleChange('whatsapp_enabled', v)}
                  data-testid="whatsapp-enabled-switch"
                />
              </div>

              <div className="border-t border-slate-100 pt-5">
                <Label className="mb-3 block">Probar Envío de WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="+57 300 123 4567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="input-corporate"
                    data-testid="test-whatsapp-phone"
                  />
                  <Button
                    onClick={handleTestWhatsApp}
                    disabled={testingWhatsApp}
                    className="btn-secondary whitespace-nowrap"
                    data-testid="test-whatsapp-btn"
                  >
                    {testingWhatsApp ? (
                      <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Email Configuration */}
          <div className="bg-white border border-slate-200 rounded-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-sm bg-blue-50 flex items-center justify-center">
                <Mail className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-chivo font-bold text-lg text-slate-900">Correo Electrónico</h3>
                <p className="text-sm text-slate-500">SMTP Office 365</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Habilitar Email</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enviar notificaciones por correo
                  </p>
                </div>
                <Switch
                  checked={config?.email_enabled || false}
                  onCheckedChange={(v) => handleChange('email_enabled', v)}
                  data-testid="email-enabled-switch"
                />
              </div>

              <div className="border-t border-slate-100 pt-5">
                <Label className="mb-3 block">Probar Envío de Email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="input-corporate"
                    data-testid="test-email-address"
                  />
                  <Button
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="btn-secondary whitespace-nowrap"
                    data-testid="test-email-btn"
                  >
                    {testingEmail ? (
                      <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Events */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-sm bg-amber-50 flex items-center justify-center">
                <Bell className="text-amber-600" size={20} />
              </div>
              <div>
                <h3 className="font-chivo font-bold text-lg text-slate-900">Eventos de Notificación</h3>
                <p className="text-sm text-slate-500">Configure qué eventos generan notificaciones</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Al crear presupuesto</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notificar cuando se crea un nuevo presupuesto
                  </p>
                </div>
                <Switch
                  checked={config?.notify_on_creation || false}
                  onCheckedChange={(v) => handleChange('notify_on_creation', v)}
                  data-testid="notify-creation-switch"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Al registrar pago</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notificar cuando se registra un pago
                  </p>
                </div>
                <Switch
                  checked={config?.notify_on_payment || false}
                  onCheckedChange={(v) => handleChange('notify_on_payment', v)}
                  data-testid="notify-payment-switch"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Si hay diferencia</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notificar cuando el pago difiere del presupuesto
                  </p>
                </div>
                <Switch
                  checked={config?.notify_on_difference || false}
                  onCheckedChange={(v) => handleChange('notify_on_difference', v)}
                  data-testid="notify-difference-switch"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Al vencer</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notificar cuando un gasto se vence
                  </p>
                </div>
                <Switch
                  checked={config?.notify_on_overdue || false}
                  onCheckedChange={(v) => handleChange('notify_on_overdue', v)}
                  data-testid="notify-overdue-switch"
                />
              </div>
            </div>

            <div className="mt-6">
              <Label>Días antes del vencimiento para notificar</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={config?.days_before_due || 3}
                onChange={(e) => handleChange('days_before_due', parseInt(e.target.value))}
                className="input-corporate mt-1.5 max-w-[150px]"
                data-testid="days-before-due-input"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
