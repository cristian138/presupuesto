import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { getUsers, updateUser } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Pencil, Search, Mail, Phone, Plus, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: 'accountant',
    is_active: true
  });
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'accountant'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleOpenCreateModal = () => {
    setCreateFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'accountant'
    });
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateChange = (name, value) => {
    setCreateFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await updateUser(editingUser.id, formData);
      toast.success('Usuario actualizado exitosamente');
      handleCloseModal();
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al actualizar el usuario';
      toast.error(message);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/users`, createFormData);
      toast.success('Usuario creado exitosamente');
      handleCloseCreateModal();
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al crear el usuario';
      toast.error(message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title="Usuarios" subtitle="Gestión de usuarios del sistema">
        <Button onClick={handleOpenCreateModal} className="btn-primary" data-testid="create-user-btn">
          <Plus size={18} className="mr-2" />
          <span className="hidden sm:inline">Nuevo Usuario</span>
        </Button>
      </Header>

      <div className="p-4 lg:p-8 animate-fade-in">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-corporate"
              data-testid="search-users-input"
            />
          </div>
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron usuarios
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6" data-testid="users-grid">
            {filteredUsers.map((user) => (
              <div 
                key={user.id}
                className={`bg-white border rounded-sm p-4 lg:p-6 ${
                  user.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50/30'
                }`}
                data-testid={`user-card-${user.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-bold text-base lg:text-lg ${
                      user.role === 'super_admin' ? 'bg-[#002D54]' : 'bg-slate-400'
                    }`}>
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 text-sm lg:text-base">{user.full_name}</h3>
                      <span className={`text-[10px] lg:text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.role === 'super_admin' 
                          ? 'bg-[#002D54]/10 text-[#002D54]' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.role === 'super_admin' ? 'Super Admin' : 'Contable'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenModal(user)}
                    className="p-2 hover:bg-slate-100 rounded-sm transition-colors"
                    data-testid={`edit-user-${user.id}`}
                  >
                    <Pencil size={16} className="text-slate-600" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} />
                    <span className="truncate text-xs lg:text-sm">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone size={14} />
                      <span className="text-xs lg:text-sm">{user.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] lg:text-xs text-slate-500">
                    Creado: {new Date(user.created_at).toLocaleDateString('es-CO')}
                  </span>
                  <span className={`text-[10px] lg:text-xs font-medium ${
                    user.is_active ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="font-chivo">Editar Usuario</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div>
                <Label>Nombre Completo</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  data-testid="user-name-input"
                />
              </div>

              <div>
                <Label>Teléfono (WhatsApp)</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="input-corporate mt-1.5"
                  placeholder="+57 300 123 4567"
                  data-testid="user-phone-input"
                />
              </div>

              <div>
                <Label>Rol</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v) => handleChange('role', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Administrador</SelectItem>
                    <SelectItem value="accountant">Usuario Contable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-sm">
                <div>
                  <Label className="mb-0">Estado del Usuario</Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Los usuarios inactivos no pueden acceder al sistema
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => handleChange('is_active', v)}
                  data-testid="user-active-switch"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary" data-testid="save-user-btn">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={handleCloseCreateModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="font-chivo">Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label>Nombre Completo</Label>
                <Input
                  value={createFormData.full_name}
                  onChange={(e) => handleCreateChange('full_name', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  placeholder="Juan Pérez"
                  data-testid="create-user-name-input"
                />
              </div>

              <div>
                <Label>Correo Electrónico</Label>
                <Input
                  type="email"
                  value={createFormData.email}
                  onChange={(e) => handleCreateChange('email', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  placeholder="correo@ejemplo.com"
                  data-testid="create-user-email-input"
                />
              </div>

              <div>
                <Label>Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={createFormData.password}
                    onChange={(e) => handleCreateChange('password', e.target.value)}
                    required
                    className="input-corporate mt-1.5 pr-10"
                    placeholder="••••••••"
                    data-testid="create-user-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 translate-y-[-25%] text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <Label>Teléfono (WhatsApp)</Label>
                <Input
                  value={createFormData.phone}
                  onChange={(e) => handleCreateChange('phone', e.target.value)}
                  className="input-corporate mt-1.5"
                  placeholder="+57 300 123 4567"
                  data-testid="create-user-phone-input"
                />
              </div>

              <div>
                <Label>Rol</Label>
                <Select 
                  value={createFormData.role} 
                  onValueChange={(v) => handleCreateChange('role', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="create-user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Administrador</SelectItem>
                    <SelectItem value="accountant">Usuario Contable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseCreateModal}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary" data-testid="create-user-submit-btn">
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
