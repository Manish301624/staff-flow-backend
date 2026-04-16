import { useState } from "react";
import { motion } from "framer-motion";
import { format, subMonths, addMonths } from "date-fns";
import {
  useListPayments, useListEmployees, useCreatePayment, useDeletePayment,
  getListPaymentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";

const methodIcon: Record<string, any> = {
  cash: Banknote,
  upi: Smartphone,
  bank: CreditCard,
};

const typeColor: Record<string, string> = {
  salary: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  advance: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  bonus: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  deduction: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const schema = z.object({
  employeeId: z.string().min(1, "Select employee"),
  amount: z.string().min(1, "Enter amount"),
  type: z.string().min(1),
  method: z.string().min(1),
  note: z.string().optional(),
  status: z.string().min(1),
});

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PaymentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: payments, isLoading } = useListPayments({ month, year });
  const { data: employees } = useListEmployees();
  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: "salary", method: "cash", status: "paid" },
  });

  const onSubmit = (data: any) => {
    createPayment.mutate({
      data: {
        employeeId: Number(data.employeeId),
        amount: Number(data.amount),
        type: data.type,
        method: data.method,
        month,
        year,
        note: data.note || null,
        status: data.status,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        toast({ title: "Payment added" });
        setShowForm(false);
        reset();
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deletePayment.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        toast({ title: "Payment deleted" });
      },
    });
  };

  const filtered = (payments ?? []).filter(p => {
    if (filterEmployee !== "all" && p.employeeId !== Number(filterEmployee)) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    return true;
  });

  const totalPaid = filtered.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = filtered.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} transactions</p>
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
          <Button onClick={() => setShowForm(true)} data-testid="button-add-payment">
            <Plus size={16} className="mr-1.5" />Add Payment
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-card-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-card-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pending Dues</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {(employees ?? []).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="salary">Salary</SelectItem>
            <SelectItem value="advance">Advance</SelectItem>
            <SelectItem value="bonus">Bonus</SelectItem>
            <SelectItem value="deduction">Deduction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No payments found for this period.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => {
            const MethodIcon = methodIcon[p.method] || CreditCard;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="border-card-border shadow-sm" data-testid={`payment-card-${p.id}`}>
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <MethodIcon size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-foreground">{p.employeeName}</p>
                          <Badge className={`text-xs px-1.5 py-0 capitalize ${typeColor[p.type] || ""}`}>{p.type}</Badge>
                          <Badge variant={p.status === "paid" ? "default" : "secondary"} className="text-xs px-1.5 py-0">{p.status}</Badge>
                        </div>
                        {p.note && <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.method}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(p.id)} data-testid={`button-delete-payment-${p.id}`}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select onValueChange={v => setValue("employeeId", v)}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="5000" {...register("amount")} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue="salary" onValueChange={v => setValue("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select defaultValue="cash" onValueChange={v => setValue("method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select defaultValue="paid" onValueChange={v => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input placeholder="Optional note..." {...register("note")} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createPayment.isPending}>Add Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
