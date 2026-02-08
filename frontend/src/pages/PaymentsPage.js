import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/Layout';
import { 
  getPayments, 
  getMonthlyBudgets,
  createPayment,
  getPaymentPDF,
  formatCurrency, 
  getMonthName,
  getStatusBadge
} from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileDown, Eye, CheckCircle, Search, Calendar } from 'lucide-react';

export const PaymentsPage = () => {
  const location = useLocation();
  const [payments, setPayments] = useState([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    monthly_budget_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    paid_value: '',
    payment_method: 'transferencia',
    observations: ''
  });

  useEffect(() => {
    fetchData();
    
    // Auto-open modal if coming from monthly page
    if (location.state?.monthlyBudget) {
      const mb = location.state.monthlyBudget;
      setFormData(prev => ({
        ...prev,
        monthly_budget_id: mb.id,
        paid_value: mb.budgeted_value.toString()
      }));
      setShowModal(true);
    }
  }, [location.state]);

  useEffect(() => {
    fetchPayments();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      const budgetsRes = await getMonthlyBudgets({ 
        month: selectedMonth, 
        year: selectedYear 
      });
      // Filter only budgets that can receive payments
      const payableBudgets = budgetsRes.data.filter(b => 
        b.payment_status === 'pendiente' || b.payment_status === 'vencido'
      );
      setMonthlyBudgets(payableBudgets);
    } catch (error) {
      console.error('Error fetching monthly budgets:', error);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await getPayments({ month: selectedMonth, year: selectedYear });
      setPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    fetchData();
    setFormData({
      monthly_budget_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      paid_value: '',
      payment_method: 'transferencia',
      observations: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    // Clear location state
    window.history.replaceState({}, document.title);
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-fill paid_value when selecting monthly budget
    if (name === 'monthly_budget_id') {
      const budget = monthlyBudgets.find(b => b.id === value);
      if (budget) {
        setFormData(prev => ({ ...prev, paid_value: budget.budgeted_value.toString() }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        paid_value: parseFloat(formData.paid_value)
      };

      const response = await createPayment(data);
      toast.success('Pago registrado exitosamente');
      
      // Show PDF modal
      setSelectedPayment({
        ...response.data,
        pdf_url: response.data.pdf_url
      });
      setShowPDFModal(true);
      
      handleCloseModal();
      fetchPayments();
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al registrar el pago';
      toast.error(message);
    }
  };

  const handleDownloadPDF = async (payment) => {
    try {
      const response = await getPaymentPDF(payment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `comprobante_${payment.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar el PDF');
    }
  };

  const handleViewPDF = (payment) => {
    setSelectedPayment(payment);
    setShowPDFModal(true);
  };

  const filteredPayments = payments.filter(p => 
    p.concept.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const selectedBudget = monthlyBudgets.find(b => b.id === formData.monthly_budget_id);

  return (
    <>
      <Header title="Pagos" subtitle="Registro y gestión de pagos">
        <Button onClick={handleOpenModal} className="btn-primary" data-testid="register-payment-btn">
          <Plus size={18} className="mr-2" />
          Registrar Pago
        </Button>
      </Header>

      <div className="p-8 animate-fade-in">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por concepto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-corporate"
              data-testid="search-payments-input"
            />
          </div>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m.toString()}>{getMonthName(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No hay pagos registrados para este período
            </div>
          ) : (
            <table className="table-corporate" data-testid="payments-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Período</th>
                  <th>Fecha Pago</th>
                  <th className="text-right">Presupuestado</th>
                  <th className="text-right">Pagado</th>
                  <th className="text-right">Diferencia</th>
                  <th>Método</th>
                  <th>Registrado Por</th>
                  <th className="w-28">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} data-testid={`payment-row-${payment.id}`}>
                    <td className="font-medium text-slate-900">{payment.concept}</td>
                    <td className="font-mono text-sm">
                      {getMonthName(payment.month).substring(0, 3)} {payment.year}
                    </td>
                    <td className="font-mono text-sm">{payment.payment_date}</td>
                    <td className="text-right font-mono">{formatCurrency(payment.budgeted_value)}</td>
                    <td className="text-right font-mono text-emerald-600">
                      {formatCurrency(payment.paid_value)}
                    </td>
                    <td className={`text-right font-mono ${
                      payment.difference > 0 ? 'text-amber-600' : 
                      payment.difference < 0 ? 'text-blue-600' : 'text-emerald-600'
                    }`}>
                      {payment.difference === 0 ? '—' : formatCurrency(Math.abs(payment.difference))}
                    </td>
                    <td className="capitalize">{payment.payment_method}</td>
                    <td className="text-sm">{payment.registered_by_name}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewPDF(payment)}
                          className="p-2 hover:bg-slate-100 rounded-sm transition-colors"
                          title="Ver PDF"
                          data-testid={`view-pdf-${payment.id}`}
                        >
                          <Eye size={16} className="text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(payment)}
                          className="p-2 hover:bg-slate-100 rounded-sm transition-colors"
                          title="Descargar PDF"
                          data-testid={`download-pdf-${payment.id}`}
                        >
                          <FileDown size={16} className="text-[#002D54]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-chivo">Registrar Pago</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div>
                <Label>Gasto Mensual</Label>
                <Select 
                  value={formData.monthly_budget_id} 
                  onValueChange={(v) => handleChange('monthly_budget_id', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-monthly-budget">
                    <SelectValue placeholder="Seleccionar gasto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {monthlyBudgets.map(budget => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.concept} - {getMonthName(budget.month)} {budget.year} - {formatCurrency(budget.budgeted_value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBudget && (
                <div className="p-4 bg-slate-50 rounded-sm border border-slate-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Valor Presupuestado:</span>
                      <span className="ml-2 font-mono font-medium">{formatCurrency(selectedBudget.budgeted_value)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Fecha Límite:</span>
                      <span className="ml-2 font-mono">{selectedBudget.due_date}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha de Pago</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => handleChange('payment_date', e.target.value)}
                    required
                    className="input-corporate mt-1.5"
                    data-testid="payment-date-input"
                  />
                </div>
                <div>
                  <Label>Valor Pagado</Label>
                  <Input
                    type="number"
                    value={formData.paid_value}
                    onChange={(e) => handleChange('paid_value', e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    className="input-corporate mt-1.5 font-mono"
                    data-testid="payment-value-input"
                  />
                </div>
              </div>

              <div>
                <Label>Método de Pago</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(v) => handleChange('payment_method', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="payment-method-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta de Crédito/Débito</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observaciones</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  className="input-corporate mt-1.5 min-h-[80px]"
                  placeholder="Notas adicionales..."
                  data-testid="payment-observations-input"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="btn-primary" 
                disabled={!formData.monthly_budget_id}
                data-testid="save-payment-btn"
              >
                <CheckCircle size={18} className="mr-2" />
                Registrar Pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Modal */}
      <Dialog open={showPDFModal} onOpenChange={() => setShowPDFModal(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-chivo">Comprobante de Pago</DialogTitle>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-4 flex items-center gap-3">
                <CheckCircle className="text-emerald-600" size={24} />
                <div>
                  <p className="font-medium text-emerald-800">Pago registrado exitosamente</p>
                  <p className="text-sm text-emerald-600">
                    Código de verificación: <span className="font-mono">{selectedPayment.verification_code}</span>
                  </p>
                </div>
              </div>

              {selectedPayment.pdf_url && (
                <div className="border border-slate-200 rounded-sm overflow-hidden shadow-2xl">
                  <iframe
                    src={selectedPayment.pdf_url}
                    className="w-full h-[500px]"
                    title="PDF Preview"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowPDFModal(false)}>
                  Cerrar
                </Button>
                <Button 
                  onClick={() => handleDownloadPDF(selectedPayment)}
                  className="btn-primary"
                >
                  <FileDown size={18} className="mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
