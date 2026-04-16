import { useState } from "react";
import { motion } from "framer-motion";
import { format, subMonths, addMonths } from "date-fns";
import {
  useGetSalarySummary, useCreatePayment,
  getGetSalarySummaryQueryKey, getListPaymentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function SalaryPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
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
        toast({ title: "Salary paid", description: `Paid ${formatCurrency(amount)} to ${employeeName}` });
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
          <p className="text-muted-foreground text-sm">Auto-calculated from attendance</p>
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
          { label: "Total Net Salary", value: formatCurrency(totalNet), icon: DollarSign, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Total Paid", value: formatCurrency(totalPaid), icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pending Dues", value: formatCurrency(totalPending), icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
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

      {/* Employee salary breakdown */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : !summary?.length ? (
        <div className="text-center py-12 text-muted-foreground">No employees found. Add employees and mark attendance to see salary calculations.</div>
      ) : (
        <div className="space-y-3">
          {summary.map((s, i) => (
            <motion.div key={s.employeeId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow" data-testid={`salary-card-${s.employeeId}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{s.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(s.baseSalary)}/{s.salaryType === "monthly" ? "month" : "day"} •
                        {s.presentDays}P + {s.halfDays}H of {s.workingDays} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{formatCurrency(s.netSalary)}</p>
                      <Badge className={s.pending > 0 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs"}>
                        {s.pending > 0 ? `₹${s.pending.toLocaleString("en-IN")} pending` : "Fully paid"}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Base</p>
                      <p className="font-semibold text-foreground">{formatCurrency(s.baseSalary)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Overtime</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(s.overtimePay)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Advances</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">-{formatCurrency(s.advances)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Deductions</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">-{formatCurrency(s.deductions)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground">Paid</p>
                      <p className="font-semibold text-foreground">{formatCurrency(s.paid)}</p>
                    </div>
                  </div>
                  {s.pending > 0 && (
                    <div className="flex justify-end mt-3">
                      <Button
                        size="sm"
                        onClick={() => handlePay(s.employeeId, s.pending, s.employeeName)}
                        disabled={createPayment.isPending}
                        data-testid={`button-pay-${s.employeeId}`}
                      >
                        Pay {formatCurrency(s.pending)}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
