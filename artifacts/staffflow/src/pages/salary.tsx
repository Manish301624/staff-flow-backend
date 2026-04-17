import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, subMonths, addMonths } from "date-fns";
import {
  useGetSalarySummary, useCreatePayment,
  getGetSalarySummaryQueryKey, getListPaymentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, ChevronRight, DollarSign, TrendingUp,
  TrendingDown, FileText, Printer, IndianRupee,
} from "lucide-react";

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function calcIndianDeductions(grossSalary: number) {
  const pf = Math.round(Math.min(grossSalary, 15000) * 0.12);
  const esi = grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0;
  const pt = grossSalary < 7500 ? 0 : grossSalary < 10000 ? 175 : 200;
  const tds = grossSalary > 50000 ? Math.round((grossSalary - 50000) * 0.3 / 12) : 0;
  const totalDeductions = pf + esi + pt + tds;
  const netSalary = grossSalary - totalDeductions;
  return { pf, esi, pt, tds, totalDeductions, netSalary };
}

type SalaryEntry = {
  employeeId: number;
  employeeName: string;
  baseSalary: number;
  salaryType: string;
  presentDays: number;
  halfDays: number;
  workingDays: number;
  overtimePay: number;
  advances: number;
  deductions: number;
  netSalary: number;
  paid: number;
  pending: number;
};

function PayslipModal({ entry, month, year, onClose }: {
  entry: SalaryEntry;
  month: number;
  year: number;
  onClose: () => void;
}) {
  const grossSalary = entry.netSalary + entry.deductions;
  const indian = calcIndianDeductions(grossSalary);
  const totalEarnings = entry.baseSalary + entry.overtimePay;
  const totalDeductions = indian.pf + indian.esi + indian.pt + indian.tds + entry.advances;
  const finalNet = totalEarnings - totalDeductions;
  const monthYear = format(new Date(year, month - 1), "MMMM yyyy");

  const handlePrint = () => window.print();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />Payslip — {entry.employeeName}
          </DialogTitle>
        </DialogHeader>

        <div id="payslip-content" className="space-y-4 text-sm">
          {/* Header */}
          <div className="flex items-start justify-between bg-primary/5 rounded-xl p-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-xs">SF</span>
                </div>
                <span className="font-bold text-foreground text-base">StaffFlow</span>
              </div>
              <p className="text-muted-foreground text-xs">Payslip for {monthYear}</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
              <Printer size={12} />Print
            </Button>
          </div>

          {/* Employee details */}
          <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-xl p-3">
            <div>
              <p className="text-xs text-muted-foreground">Employee</p>
              <p className="font-semibold text-foreground">{entry.employeeName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pay Period</p>
              <p className="font-semibold text-foreground">{monthYear}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days Worked</p>
              <p className="font-semibold text-foreground">{entry.presentDays}P + {entry.halfDays}H / {entry.workingDays}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pay Type</p>
              <p className="font-semibold text-foreground capitalize">{entry.salaryType}</p>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Earnings</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Basic Salary</span>
                <span className="font-medium text-foreground">{fmt(entry.baseSalary)}</span>
              </div>
              {entry.overtimePay > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime Pay</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{fmt(entry.overtimePay)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border font-semibold">
                <span>Gross Salary</span>
                <span className="text-foreground">{fmt(totalEarnings)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statutory Deductions</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  PF (Employee 12%)
                  <span className="ml-1 text-xs text-muted-foreground/70">on {fmt(Math.min(grossSalary, 15000))}</span>
                </span>
                <span className="font-medium text-red-600 dark:text-red-400">-{fmt(indian.pf)}</span>
              </div>
              {indian.esi > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ESI (0.75%)</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-{fmt(indian.esi)}</span>
                </div>
              )}
              {indian.pt > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Professional Tax</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-{fmt(indian.pt)}</span>
                </div>
              )}
              {indian.tds > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TDS (Income Tax)</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-{fmt(indian.tds)}</span>
                </div>
              )}
              {entry.advances > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salary Advance</span>
                  <span className="font-medium text-red-600 dark:text-red-400">-{fmt(entry.advances)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600 dark:text-red-400">-{fmt(totalDeductions)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Net Pay */}
          <div className="flex justify-between items-center bg-primary/5 rounded-xl p-4">
            <div>
              <p className="text-xs text-muted-foreground">Net Pay</p>
              <p className="text-2xl font-bold text-foreground">{fmt(finalNet)}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>PF Employer: {fmt(Math.min(grossSalary, 15000) * 0.12)}</p>
              <p>ESI Employer: {fmt(grossSalary <= 21000 ? grossSalary * 0.0325 : 0)}</p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            This is a computer-generated payslip. No signature required.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SalaryPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payslipEntry, setPayslipEntry] = useState<SalaryEntry | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: summary, isLoading } = useGetSalarySummary(
    { month, year },
    { query: { queryKey: getGetSalarySummaryQueryKey({ month, year }) } }
  );
  const createPayment = useCreatePayment();

  const handlePay = (employeeId: number, amount: number, employeeName: string) => {
    createPayment.mutate({
      data: {
        employeeId,
        amount,
        type: "salary",
        method: "bank",
        month,
        year,
        status: "paid",
        note: `${format(currentDate, "MMMM yyyy")} salary`,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSalarySummaryQueryKey({ month, year }) });
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        toast({ title: "Salary paid", description: `Paid ${fmt(amount)} to ${employeeName}` });
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const totalNet = (summary ?? []).reduce((sum, s) => sum + s.netSalary, 0);
  const totalPaid = (summary ?? []).reduce((sum, s) => sum + s.paid, 0);
  const totalPending = (summary ?? []).reduce((sum, s) => sum + s.pending, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salary</h1>
          <p className="text-muted-foreground text-sm">Indian payroll with PF, ESI, PT & TDS</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[110px] text-center">{format(currentDate, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Gross Payroll", value: fmt(totalNet), icon: IndianRupee, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Total Paid", value: fmt(totalPaid), icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pending Dues", value: fmt(totalPending), icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-card-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                    <p className="text-xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${card.bg}`}><card.icon size={18} className={card.color} /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Indian deductions info bar */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "PF", desc: "12% on capped ₹15,000", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
          { label: "ESI", desc: "0.75% if gross ≤ ₹21,000", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
          { label: "PT", desc: "₹200/month slab", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
          { label: "TDS", desc: "30% above ₹50,000", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
        ].map(d => (
          <span key={d.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${d.color}`}>
            <span className="font-bold">{d.label}</span>
            <span className="opacity-80">{d.desc}</span>
          </span>
        ))}
      </div>

      {/* Employee salary breakdown */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      ) : !summary?.length ? (
        <div className="text-center py-12 text-muted-foreground">No employees found. Add employees and mark attendance to see salary calculations.</div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {summary.map((s, i) => {
              const gross = s.netSalary + s.deductions;
              const indian = calcIndianDeductions(gross);
              return (
                <motion.div key={s.employeeId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow" data-testid={`salary-card-${s.employeeId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground">{s.employeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(s.baseSalary)}/{s.salaryType === "monthly" ? "mo" : "day"} •
                            {" "}{s.presentDays}P + {s.halfDays}H of {s.workingDays} days
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground"
                            onClick={() => setPayslipEntry(s as SalaryEntry)}
                            data-testid={`button-payslip-${s.employeeId}`}
                          >
                            <FileText size={13} />Payslip
                          </Button>
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">{fmt(s.netSalary)}</p>
                            <Badge className={s.pending > 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs"
                            }>
                              {s.pending > 0 ? `${fmt(s.pending)} pending` : "Fully paid"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-muted-foreground">Gross</p>
                          <p className="font-semibold text-foreground">{fmt(s.baseSalary + s.overtimePay)}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                          <p className="text-muted-foreground">PF</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">-{fmt(indian.pf)}</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                          <p className="text-muted-foreground">ESI + PT</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">-{fmt(indian.esi + indian.pt)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <p className="text-muted-foreground">Net Pay</p>
                          <p className="font-semibold text-foreground">{fmt(gross - indian.totalDeductions - s.advances)}</p>
                        </div>
                      </div>

                      {s.pending > 0 && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handlePay(s.employeeId, s.pending, s.employeeName)}
                            disabled={createPayment.isPending}
                            data-testid={`button-pay-${s.employeeId}`}
                            className="h-8 text-xs"
                          >
                            Pay {fmt(s.pending)}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {payslipEntry && (
        <PayslipModal
          entry={payslipEntry}
          month={month}
          year={year}
          onClose={() => setPayslipEntry(null)}
        />
      )}
    </div>
  );
}
