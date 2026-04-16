import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreatePayment, useListEmployees, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  amount: z.string().min(1, "Enter amount"),
  type: z.string().min(1, "Select type"),
  method: z.string().min(1, "Select method"),
  note: z.string().optional(),
});

export default function QuickAddPayment() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees } = useListEmployees();
  const createPayment = useCreatePayment();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: "salary", method: "cash" },
  });

  const onSubmit = (data: any) => {
    const now = new Date();
    createPayment.mutate({
      data: {
        employeeId: Number(data.employeeId),
        amount: Number(data.amount),
        type: data.type,
        method: data.method,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        note: data.note || null,
        status: "paid",
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        toast({ title: "Payment added", description: "Payment recorded successfully." });
        setOpen(false);
        reset();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.data?.error || "Failed to add payment", variant: "destructive" });
      },
    });
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg font-medium text-sm"
        data-testid="button-quick-add-payment"
      >
        <Plus size={18} />
        <span>Quick Payment</span>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Add Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select onValueChange={v => setValue("employeeId", v)}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employeeId && <p className="text-xs text-destructive">{String(errors.employeeId.message)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="5000" data-testid="input-amount" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{String(errors.amount.message)}</p>}
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
            </div>

            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select defaultValue="cash" onValueChange={v => setValue("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. April salary" data-testid="input-note" {...register("note")} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createPayment.isPending}>
                {createPayment.isPending ? "Adding..." : "Add Payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
