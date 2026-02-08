import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { getDashboardKPI, getMonthlySummary, formatCurrency, getMonthName } from '../services/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export const DashboardPage = () => {
  const [kpi, setKpi] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiRes, summaryRes] = await Promise.all([
        getDashboardKPI({ month: selectedMonth, year: selectedYear }),
        getMonthlySummary(selectedYear)
      ]);
      setKpi(kpiRes.data);
      setMonthlySummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = monthlySummary.map(item => ({
    name: getMonthName(item.month).substring(0, 3),
    Presupuestado: item.budgeted,
    Ejecutado: item.executed
  }));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" subtitle="Panel de control financiero" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" subtitle="Panel de control financiero">
        <div className="flex items-center gap-3">
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
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="kpi-card" data-testid="kpi-budgeted">
            <div className="flex items-start justify-between">
              <div>
                <div className="kpi-value text-[#002D54]">
                  {formatCurrency(kpi?.total_budgeted || 0)}
                </div>
                <div className="kpi-label">Total Presupuestado</div>
              </div>
              <div className="w-10 h-10 rounded-sm bg-blue-50 flex items-center justify-center">
                <Calendar className="text-[#002D54]" size={20} />
              </div>
            </div>
          </div>

          <div className="kpi-card" data-testid="kpi-executed">
            <div className="flex items-start justify-between">
              <div>
                <div className="kpi-value text-emerald-600">
                  {formatCurrency(kpi?.total_executed || 0)}
                </div>
                <div className="kpi-label">Total Ejecutado</div>
              </div>
              <div className="w-10 h-10 rounded-sm bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="text-emerald-600" size={20} />
              </div>
            </div>
          </div>

          <div className="kpi-card" data-testid="kpi-percentage">
            <div className="flex items-start justify-between">
              <div>
                <div className="kpi-value">
                  {kpi?.execution_percentage?.toFixed(1) || 0}%
                </div>
                <div className="kpi-label">% de Ejecución</div>
              </div>
              <div className="w-10 h-10 rounded-sm bg-amber-50 flex items-center justify-center">
                {(kpi?.execution_percentage || 0) >= 80 ? (
                  <TrendingUp className="text-emerald-600" size={20} />
                ) : (
                  <TrendingDown className="text-amber-600" size={20} />
                )}
              </div>
            </div>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#002D54] transition-all duration-500"
                style={{ width: `${Math.min(kpi?.execution_percentage || 0, 100)}%` }}
              />
            </div>
          </div>

          <div className="kpi-card" data-testid="kpi-difference">
            <div className="flex items-start justify-between">
              <div>
                <div className={`kpi-value ${(kpi?.total_difference || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatCurrency(Math.abs(kpi?.total_difference || 0))}
                </div>
                <div className="kpi-label">
                  {(kpi?.total_difference || 0) > 0 ? 'Pendiente por Ejecutar' : 'Sobre-ejecutado'}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                (kpi?.total_difference || 0) > 0 ? 'bg-amber-50' : 'bg-emerald-50'
              }`}>
                <AlertTriangle className={(kpi?.total_difference || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'} size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-sm p-5 flex items-center gap-4" data-testid="status-pending">
            <div className="w-12 h-12 rounded-sm bg-amber-50 flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-slate-900">{kpi?.pending_count || 0}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Pendientes</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-5 flex items-center gap-4" data-testid="status-paid">
            <div className="w-12 h-12 rounded-sm bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-slate-900">{kpi?.paid_count || 0}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Pagados</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-5 flex items-center gap-4" data-testid="status-difference">
            <div className="w-12 h-12 rounded-sm bg-blue-50 flex items-center justify-center">
              <AlertTriangle className="text-blue-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-slate-900">{kpi?.with_difference_count || 0}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Con Diferencia</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-5 flex items-center gap-4" data-testid="status-overdue">
            <div className="w-12 h-12 rounded-sm bg-red-50 flex items-center justify-center">
              <AlertCircle className="text-red-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-slate-900">{kpi?.overdue_count || 0}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Vencidos</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border border-slate-200 rounded-sm p-6" data-testid="monthly-chart">
          <h3 className="font-chivo font-bold text-lg text-slate-900 mb-6">
            Presupuesto vs Ejecución - {selectedYear}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  stroke="#94A3B8"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E2E8F0',
                    borderRadius: '4px'
                  }}
                />
                <Legend />
                <Bar dataKey="Presupuestado" fill="#002D54" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ejecutado" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};
