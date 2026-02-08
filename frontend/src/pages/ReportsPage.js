import React, { useState, useEffect } from 'react';
import { Header } from '../components/Layout';
import { 
  getMonthlyReportPDF, 
  getDashboardKPI,
  getMonthlySummary,
  formatCurrency, 
  getMonthName 
} from '../services/api';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { FileDown, FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const ReportsPage = () => {
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
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await getMonthlyReportPDF(selectedMonth, selectedYear);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_${selectedMonth}_${selectedYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte PDF descargado');
    } catch (error) {
      toast.error('Error al descargar el reporte PDF');
    }
  };

  const handleDownloadExcel = () => {
    try {
      // Prepare data for Excel
      const summaryData = monthlySummary.map(item => ({
        'Mes': getMonthName(item.month),
        'Año': item.year,
        'Presupuestado': item.budgeted,
        'Ejecutado': item.executed,
        'Diferencia': item.difference,
        '% Ejecución': `${item.execution_percentage}%`
      }));

      // Add totals row
      const totals = monthlySummary.reduce((acc, item) => ({
        budgeted: acc.budgeted + item.budgeted,
        executed: acc.executed + item.executed,
        difference: acc.difference + item.difference
      }), { budgeted: 0, executed: 0, difference: 0 });

      summaryData.push({
        'Mes': 'TOTAL',
        'Año': selectedYear,
        'Presupuestado': totals.budgeted,
        'Ejecutado': totals.executed,
        'Diferencia': totals.difference,
        '% Ejecución': totals.budgeted > 0 ? `${((totals.executed / totals.budgeted) * 100).toFixed(1)}%` : '0%'
      });

      const worksheet = XLSX.utils.json_to_sheet(summaryData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen Anual');

      // Auto-width columns
      const maxWidth = summaryData.reduce((acc, row) => {
        Object.keys(row).forEach((key, idx) => {
          const len = String(row[key]).length;
          acc[idx] = Math.max(acc[idx] || 10, len + 2);
        });
        return acc;
      }, {});
      worksheet['!cols'] = Object.values(maxWidth).map(w => ({ wch: w }));

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `reporte_anual_${selectedYear}.xlsx`);
      toast.success('Reporte Excel descargado');
    } catch (error) {
      toast.error('Error al generar el reporte Excel');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <>
      <Header title="Reportes" subtitle="Generación de reportes financieros">
        <div className="flex items-center gap-3">
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
      </Header>

      <div className="p-8 animate-fade-in">
        {/* Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div 
            className="bg-white border border-slate-200 rounded-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={handleDownloadPDF}
            data-testid="download-pdf-report"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-sm bg-red-50 flex items-center justify-center">
                <FileText className="text-red-600" size={28} />
              </div>
              <div className="flex-1">
                <h3 className="font-chivo font-bold text-lg text-slate-900 mb-1">
                  Reporte Mensual PDF
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Descargar reporte de {getMonthName(selectedMonth)} {selectedYear} en formato PDF
                </p>
                <Button className="btn-primary">
                  <FileDown size={18} className="mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          </div>

          <div 
            className="bg-white border border-slate-200 rounded-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={handleDownloadExcel}
            data-testid="download-excel-report"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-sm bg-emerald-50 flex items-center justify-center">
                <FileSpreadsheet className="text-emerald-600" size={28} />
              </div>
              <div className="flex-1">
                <h3 className="font-chivo font-bold text-lg text-slate-900 mb-1">
                  Reporte Anual Excel
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Descargar resumen anual de {selectedYear} en formato Excel
                </p>
                <Button className="btn-secondary">
                  <FileDown size={18} className="mr-2" />
                  Descargar Excel
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly KPI Summary */}
        {kpi && (
          <div className="bg-white border border-slate-200 rounded-sm p-6 mb-8">
            <h3 className="font-chivo font-bold text-lg text-slate-900 mb-6">
              Resumen {getMonthName(selectedMonth)} {selectedYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Presupuestado
                </div>
                <div className="text-2xl font-mono font-bold text-[#002D54]">
                  {formatCurrency(kpi.total_budgeted)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ejecutado
                </div>
                <div className="text-2xl font-mono font-bold text-emerald-600">
                  {formatCurrency(kpi.total_executed)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  % Ejecución
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold">{kpi.execution_percentage.toFixed(1)}%</span>
                  {kpi.execution_percentage >= 80 ? (
                    <TrendingUp className="text-emerald-600" size={20} />
                  ) : (
                    <TrendingDown className="text-amber-600" size={20} />
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Diferencia
                </div>
                <div className={`text-2xl font-mono font-bold ${
                  kpi.total_difference > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {formatCurrency(Math.abs(kpi.total_difference))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Annual Summary Table */}
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-chivo font-bold text-lg text-slate-900">
              Resumen Anual {selectedYear}
            </h3>
          </div>
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#002D54]/30 border-t-[#002D54] rounded-full animate-spin" />
            </div>
          ) : monthlySummary.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No hay datos para este año
            </div>
          ) : (
            <table className="table-corporate" data-testid="annual-summary-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="text-right">Presupuestado</th>
                  <th className="text-right">Ejecutado</th>
                  <th className="text-right">Diferencia</th>
                  <th className="text-right">% Ejecución</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((item) => (
                  <tr key={item.month}>
                    <td className="font-medium">{getMonthName(item.month)}</td>
                    <td className="text-right font-mono">{formatCurrency(item.budgeted)}</td>
                    <td className="text-right font-mono text-emerald-600">{formatCurrency(item.executed)}</td>
                    <td className={`text-right font-mono ${
                      item.difference > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {formatCurrency(Math.abs(item.difference))}
                    </td>
                    <td className="text-right font-mono">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        item.execution_percentage >= 80 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : item.execution_percentage >= 50 
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {item.execution_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td>TOTAL</td>
                  <td className="text-right font-mono">
                    {formatCurrency(monthlySummary.reduce((sum, i) => sum + i.budgeted, 0))}
                  </td>
                  <td className="text-right font-mono text-emerald-600">
                    {formatCurrency(monthlySummary.reduce((sum, i) => sum + i.executed, 0))}
                  </td>
                  <td className="text-right font-mono">
                    {formatCurrency(Math.abs(monthlySummary.reduce((sum, i) => sum + i.difference, 0)))}
                  </td>
                  <td className="text-right font-mono">
                    {(() => {
                      const totalBudgeted = monthlySummary.reduce((sum, i) => sum + i.budgeted, 0);
                      const totalExecuted = monthlySummary.reduce((sum, i) => sum + i.executed, 0);
                      return totalBudgeted > 0 ? ((totalExecuted / totalBudgeted) * 100).toFixed(1) : 0;
                    })()}%
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </>
  );
};
