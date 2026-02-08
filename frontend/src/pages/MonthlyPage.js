import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { 
  getMonthlyBudgets, 
  formatCurrency, 
  getMonthName,
  getStatusBadge,
  getExpenseTypeLabel
} from '../services/api';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Calendar, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

export const MonthlyPage = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { month: selectedMonth, year: selectedYear };
      const response = await getMonthlyBudgets(params);
      setBudgets(response.data);
    } catch (error) {
      console.error('Error fetching monthly budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = budgets.filter(b => 
    statusFilter === 'all' || b.payment_status === statusFilter
  );

  const totals = {
    budgeted: filteredBudgets.reduce((sum, b) => sum + b.budgeted_value, 0),
    executed: filteredBudgets.reduce((sum, b) => sum + b.executed_value, 0),
    difference: filteredBudgets.reduce((sum, b) => sum + b.difference, 0)
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleRegisterPayment = (monthlyBudget) => {
    navigate('/payments', { state: { monthlyBudget } });
  };

  return (
    <>
      <Header title="Vista Mensual" subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="status-filter">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="pagado_con_diferencia">Con Diferencia</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36" data-testid="month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m.toString()}>{getMonthName(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24" data-testid="year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Header>

      <div className="p-8 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="kpi-card" data-testid="total-budgeted">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-sm bg-[#002D54]/10 flex items-center justify-center">
                <Calendar className="text-[#002D54]" size={20} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Presupuestado
              </span>
            </div>
            <div className="kpi-value text-[#002D54]">{formatCurrency(totals.budgeted)}</div>
          </div>

          <div className="kpi-card" data-testid="total-executed">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-sm bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="text-emerald-600" size={20} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ejecutado
              </span>
            </div>
            <div className="kpi-value text-emerald-600">{formatCurrency(totals.executed)}</div>
          </div>

          <div className="kpi-card" data-testid="total-difference">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                totals.difference > 0 ? 'bg-amber-50' : 'bg-emerald-50'
              }`}>
                <TrendingDown className={totals.difference > 0 ? 'text-amber-600' : 'text-emerald-600'} size={20} />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Diferencia
              </span>
            </div>
            <div className={`kpi-value ${totals.difference > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(Math.abs(totals.difference))}
            </div>
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
              No hay gastos presupuestados para este período
            </div>
          ) : (
            <table className="table-corporate" data-testid="monthly-budgets-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Tipo</th>
                  <th>Fecha Límite</th>
                  <th className="text-right">Presupuestado</th>
                  <th className="text-right">Ejecutado</th>
                  <th className="text-right">Diferencia</th>
                  <th>Estado</th>
                  <th className="w-32">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.map((budget) => {
                  const status = getStatusBadge(budget.payment_status);
                  const canPay = budget.payment_status === 'pendiente' || budget.payment_status === 'vencido';
                  const isOverdue = budget.payment_status === 'vencido';
                  
                  return (
                    <tr 
                      key={budget.id} 
                      className={isOverdue ? 'bg-red-50/50' : ''}
                      data-testid={`monthly-row-${budget.id}`}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          {isOverdue && <AlertCircle size={16} className="text-red-500" />}
                          <span className="font-medium text-slate-900">{budget.concept}</span>
                        </div>
                      </td>
                      <td>{getExpenseTypeLabel(budget.expense_type)}</td>
                      <td className="font-mono text-sm">{budget.due_date}</td>
                      <td className="text-right font-mono">{formatCurrency(budget.budgeted_value)}</td>
                      <td className="text-right font-mono text-emerald-600">
                        {formatCurrency(budget.executed_value)}
                      </td>
                      <td className={`text-right font-mono ${
                        budget.difference > 0 ? 'text-amber-600' : budget.difference < 0 ? 'text-blue-600' : ''
                      }`}>
                        {formatCurrency(Math.abs(budget.difference))}
                      </td>
                      <td>
                        <span className={status.class}>{status.label}</span>
                      </td>
                      <td>
                        {canPay ? (
                          <Button
                            size="sm"
                            onClick={() => handleRegisterPayment(budget)}
                            className="bg-[#002D54] hover:bg-[#001A33] text-white text-xs"
                            data-testid={`pay-btn-${budget.id}`}
                          >
                            <CreditCard size={14} className="mr-1" />
                            Registrar Pago
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};
