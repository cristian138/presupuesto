import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import axios from 'axios';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_audit-pay-track/artifacts/ha0eypok_ICONO-NEGATIVO--SIN-FONDO.png";
const BG_URL = "https://images.unsplash.com/photo-1770009971150-f50bc7a373a4?auto=format&fit=crop&w=1920&q=80";
const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const LoginPage = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [allowRegister, setAllowRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: ''
  });

  // Check if any users exist (only allow registration if no users exist)
  useEffect(() => {
    const checkUsers = async () => {
      try {
        // Try to access a public endpoint or check users
        // If we get a 401, it means the system has users and requires login
        // For now, we'll make registration available only for first setup
        const response = await axios.get(`${API}/auth/check-users`).catch(() => null);
        if (response && response.data && response.data.allow_register) {
          setAllowRegister(true);
        } else {
          setAllowRegister(false);
        }
      } catch {
        setAllowRegister(false);
      } finally {
        setCheckingUsers(false);
      }
    };
    checkUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Sesión iniciada correctamente');
      } else {
        await register({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone || null
        });
        toast.success('Cuenta creada exitosamente');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Error en la autenticación';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-8 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 lg:mb-12">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#002D54] rounded-sm flex items-center justify-center">
              <img src={LOGO_URL} alt="Logo" className="w-6 h-6 lg:w-8 lg:h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-chivo font-bold text-lg lg:text-xl text-slate-900">Academia Jotuns Club</h1>
              <p className="text-[10px] lg:text-xs text-slate-500">Sistema de Control Presupuestal</p>
            </div>
          </div>

          {/* Title */}
          <div className="mb-6 lg:mb-8">
            <h2 className="font-chivo font-bold text-xl lg:text-2xl text-slate-900 mb-2">
              {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta Inicial'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin 
                ? 'Ingrese sus credenciales para acceder al sistema' 
                : 'Configure la cuenta del Super Administrador'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
            {!isLogin && (
              <>
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Nombre Completo
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required={!isLogin}
                    value={formData.full_name}
                    onChange={handleChange}
                    className="input-corporate"
                    placeholder="Juan Pérez"
                    data-testid="register-fullname-input"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700 mb-1.5 block">
                    Teléfono (WhatsApp)
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-corporate"
                    placeholder="+57 300 123 4567"
                    data-testid="register-phone-input"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="input-corporate"
                placeholder="correo@ejemplo.com"
                data-testid="login-email-input"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 mb-1.5 block">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-corporate pr-10"
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-11 flex items-center justify-center gap-2"
              data-testid="login-submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  Iniciar Sesión
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Crear Cuenta
                </>
              )}
            </Button>
          </form>

          {/* Toggle - only show if registration is allowed (no users exist) */}
          {!checkingUsers && allowRegister && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-[#002D54] hover:underline"
                data-testid="toggle-auth-mode-btn"
              >
                {isLogin ? '¿Primera vez? Crear cuenta de administrador' : '¿Ya tienes cuenta? Inicia Sesión'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Image */}
      <div 
        className="hidden lg:flex w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${BG_URL})` }}
      >
        <div className="absolute inset-0 bg-[#002D54]/80" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <img src={LOGO_URL} alt="Logo" className="w-24 h-24 mb-8" />
          <h2 className="font-chivo font-bold text-3xl mb-4 text-center">
            Academia Jotuns Club
          </h2>
          <p className="text-white/80 text-center max-w-md">
            Sistema de Control Presupuestal para la gestión 
            integral de gastos, pagos y reportes financieros.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6 text-center">
            <div className="bg-white/10 rounded-sm p-4">
              <div className="text-2xl font-bold font-mono">100%</div>
              <div className="text-xs text-white/70 uppercase tracking-wider mt-1">Trazabilidad</div>
            </div>
            <div className="bg-white/10 rounded-sm p-4">
              <div className="text-2xl font-bold font-mono">24/7</div>
              <div className="text-xs text-white/70 uppercase tracking-wider mt-1">Disponibilidad</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
