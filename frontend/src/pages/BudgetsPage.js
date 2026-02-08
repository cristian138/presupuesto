import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { 
  getBudgets, 
  createBudget, 
  updateBudget, 
  deleteBudget, 
  getUsers,
  formatCurrency, 
  getStatusBadge,
  getExpenseTypeLabel
} from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';

export const BudgetsPage = () => {
  const { isSuperAdmin } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    expense_type: 'fijo',
    concept: '',
    monthly_value: '',
    total_months: '',
    start_date: '',
    end_date: '',
    responsible_id: '',
    responsible_name: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [budgetsRes, usersRes] = await Promise.all([
        getBudgets(),
        getUsers().catch(() => ({ data: [] }))
      ]);
      setBudgets(budgetsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (budget = null) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData({
        expense_type: budget.expense_type,
        concept: budget.concept,
        monthly_value: budget.monthly_value.toString(),
        total_months: budget.total_months.toString(),
        start_date: budget.start_date,
        end_date: budget.end_date,
        responsible_id: budget.responsible_id,
        responsible_name: budget.responsible_name,
        notes: budget.notes || ''
      });
    } else {
      setEditingBudget(null);
      setFormData({
        expense_type: 'fijo',
        concept: '',
        monthly_value: '',
        total_months: '',
        start_date: '',
        end_date: '',
        responsible_id: '',
        responsible_name: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBudget(null);
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-select responsible name when ID changes
    if (name === 'responsible_id') {
      const user = users.find(u => u.id === value);
      if (user) {
        setFormData(prev => ({ ...prev, responsible_name: user.full_name }));
      }
    }
    
    // Auto-calculate end date
    if (name === 'start_date' || name === 'total_months') {
      const startDate = name === 'start_date' ? value : formData.start_date;
      const months = name === 'total_months' ? parseInt(value) : parseInt(formData.total_months);
      
      if (startDate && months && months > 0) {
        const start = new Date(startDate);
        start.setMonth(start.getMonth() + months - 1);
        const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        setFormData(prev => ({ ...prev, end_date: lastDay.toISOString().split('T')[0] }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        monthly_value: parseFloat(formData.monthly_value),
        total_months: parseInt(formData.total_months)
      };

      if (editingBudget) {
        await updateBudget(editingBudget.id, data);
        toast.success('Presupuesto actualizado exitosamente');
      } else {
        await createBudget(data);
        toast.success('Presupuesto creado exitosamente');
      }
      
      handleCloseModal();
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al guardar el presupuesto';
      toast.error(message);
    }
  };

  const handleDelete = async (budget) => {
    if (!window.confirm(`¿Está seguro de eliminar el presupuesto "${budget.concept}"?`)) return;
    
    try {
      await deleteBudget(budget.id);
      toast.success('Presupuesto eliminado exitosamente');
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al eliminar el presupuesto';
      toast.error(message);
    }
  };

  const filteredBudgets = budgets.filter(b => 
    b.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Header title="Presupuestos" subtitle="Gestión de gastos presupuestados">
        {isSuperAdmin() && (
          <Button onClick={() => handleOpenModal()} className="btn-primary" data-testid="create-budget-btn">
            <Plus size={18} className="mr-2" />
            Nuevo Presupuesto
          </Button>
        )}
      </Header>

      <div className="p-8 animate-fade-in">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por concepto o responsable..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-corporate"
              data-testid="search-budgets-input"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              {searchTerm ? 'No se encontraron presupuestos' : 'No hay presupuestos registrados'}
            </div>
          ) : (
            <table className="table-corporate" data-testid="budgets-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Tipo</th>
                  <th>Valor Mensual</th>
                  <th>Meses</th>
                  <th>Período</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  {isSuperAdmin() && <th className="w-24">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.map((budget) => {
                  const status = getStatusBadge(budget.status);
                  return (
                    <tr key={budget.id} data-testid={`budget-row-${budget.id}`}>
                      <td className="font-medium text-slate-900">{budget.concept}</td>
                      <td>{getExpenseTypeLabel(budget.expense_type)}</td>
                      <td className="font-mono">{formatCurrency(budget.monthly_value)}</td>
                      <td className="font-mono">{budget.total_months}</td>
                      <td className="text-sm">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar size={14} />
                          {budget.start_date} - {budget.end_date}
                        </div>
                      </td>
                      <td>{budget.responsible_name}</td>
                      <td>
                        <span className={status.class}>{status.label}</span>
                      </td>
                      {isSuperAdmin() && (
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenModal(budget)}
                              className="p-2 hover:bg-slate-100 rounded-sm transition-colors"
                              data-testid={`edit-budget-${budget.id}`}
                            >
                              <Pencil size={16} className="text-slate-600" />
                            </button>
                            <button
                              onClick={() => handleDelete(budget)}
                              className="p-2 hover:bg-red-50 rounded-sm transition-colors"
                              data-testid={`delete-budget-${budget.id}`}
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-chivo">
              {editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="col-span-2">
                <Label>Concepto del Gasto</Label>
                <Input
                  value={formData.concept}
                  onChange={(e) => handleChange('concept', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  placeholder="Ej: Crédito financiero"
                  data-testid="budget-concept-input"
                />
              </div>

              <div>
                <Label>Tipo de Gasto</Label>
                <Select 
                  value={formData.expense_type} 
                  onValueChange={(v) => handleChange('expense_type', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="budget-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijo">Fijo</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="ocasional">Ocasional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Valor Mensual</Label>
                <Input
                  type="number"
                  value={formData.monthly_value}
                  onChange={(e) => handleChange('monthly_value', e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  className="input-corporate mt-1.5 font-mono"
                  placeholder="0.00"
                  data-testid="budget-value-input"
                />
              </div>

              <div>
                <Label>Número de Meses</Label>
                <Input
                  type="number"
                  value={formData.total_months}
                  onChange={(e) => handleChange('total_months', e.target.value)}
                  required
                  min="1"
                  className="input-corporate mt-1.5"
                  placeholder="12"
                  data-testid="budget-months-input"
                />
              </div>

              <div>
                <Label>Fecha de Inicio</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  data-testid="budget-start-date-input"
                />
              </div>

              <div>
                <Label>Fecha de Finalización</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  required
                  className="input-corporate mt-1.5"
                  data-testid="budget-end-date-input"
                />
              </div>

              <div>
                <Label>Responsable</Label>
                <Select 
                  value={formData.responsible_id} 
                  onValueChange={(v) => handleChange('responsible_id', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="budget-responsible-select">
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  className="input-corporate mt-1.5 min-h-[80px]"
                  placeholder="Notas adicionales..."
                  data-testid="budget-notes-input"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-primary" data-testid="save-budget-btn">
                {editingBudget ? 'Actualizar' : 'Crear Presupuesto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
