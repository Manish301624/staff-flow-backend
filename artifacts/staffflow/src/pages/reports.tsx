import { useState } from "react";
import { motion } from "framer-motion";
import { format, subMonths, addMonths } from "date-fns";
import {
  useGetMonthlyReport,
  getGetMonthlyReportQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const CHART_COLORS = ["#7c3aed", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];

export default function ReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: reports, isLoading } = useGetMonthlyReport(
    { month, year },
    { query: { queryKey: getGetMonthlyReportQueryKey({ month, year }) } }
  );

  const handleExport = () => {
    if (!reports) return;
    const rows = [
      ["Employee", "Net Salary", "Paid", "Pending"],
      ...(reports.employees ?? []).map(e => [
        e.employeeName,
        formatCurrency(e.netSalary),
        formatCurrency(e.paid),
        formatCurrency(e.pending),
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `StaffFlow-Report-${format(currentDate, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paymentPieData = reports ? [
    { name: "Paid", value: reports.totalSalaryPaid, color: "#10b981" },
    { name: "Pending", value: reports.totalPending, color: "#f43f5e" },
  ].filter(d => d.value > 0) : [];

  const salaryBarData = (reports?.employees ?? []).map(e => ({
    name: e.employeeName.split(" ")[0],
    net: e.netSalary,
    paid: e.paid,
    pending: e.pending,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Analytics and monthly overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-medium min-w-[110px] text-center">{format(currentDate, "MMMM yyyy")}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight size={14} />
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!reports} data-testid="button-export-csv">
            <Download size={15} className="mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : !reports ? (
        <div className="text-center py-12 text-muted-foreground">No data for this period.</div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Employees", value: reports.totalEmployees },
              { label: "Attendance Rate", value: `${reports.attendanceRate}%` },
              { label: "Total Salary", value: formatCurrency(reports.totalSalaryPaid + reports.totalPending) },
              { label: "Total Paid", value: formatCurrency(reports.totalSalaryPaid) },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card className="border-card-border shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                    <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Salary bar chart */}
            {salaryBarData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-card-border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Salary by Employee</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={salaryBarData} barSize={16}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis hide />
                        <Tooltip
                          formatter={(val) => formatCurrency(Number(val))}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                        />
                        <Bar dataKey="net" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Net" />
                        <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="Paid" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Payment pie */}
            {paymentPieData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-card-border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Payment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                          {paymentPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        <Tooltip formatter={(val) => formatCurrency(Number(val))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Employee breakdown table */}
          {reports.employees && reports.employees.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-card-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Employee Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Employee", "Present", "Half Day", "Net Salary", "Paid", "Pending"].map(h => (
                            <th key={h} className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reports.employees.map(e => (
                          <tr key={e.employeeId} className="border-b border-border/50 last:border-0" data-testid={`report-row-${e.employeeId}`}>
                            <td className="py-2.5 px-2 font-medium text-foreground">{e.employeeName}</td>
                            <td className="py-2.5 px-2 text-emerald-600 dark:text-emerald-400 font-medium">{e.presentDays}</td>
                            <td className="py-2.5 px-2 text-amber-600 dark:text-amber-400 font-medium">{e.halfDays}</td>
                            <td className="py-2.5 px-2 text-foreground">{formatCurrency(e.netSalary)}</td>
                            <td className="py-2.5 px-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(e.paid)}</td>
                            <td className="py-2.5 px-2 text-red-600 dark:text-red-400">{formatCurrency(e.pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
