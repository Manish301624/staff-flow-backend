import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  useListLeaves, useCreateLeave, useApproveLeave, useRejectLeave, useDeleteLeave,
  useGetLeaveBalances, useListEmployees,
  getListLeavesQueryKey, getGetLeaveBalancesQueryKey,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, CheckCircle2, XCircle, Clock, Trash2,
  CalendarDays, User, Briefcase, Heart, Star, AlertCircle,
} from "lucide-react";

const leaveTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  casual: { icon: CalendarDays, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  sick: { icon: Heart, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30" },
  earned: { icon: Star, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  maternity: { icon: User, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-900/30" },
  paternity: { icon: User, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  other: { icon: Briefcase, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const schema = z.object({
  employeeId: z.string().min(1, "Select employee"),
  type: z.string().min(1, "Select type"),
  startDate: z.string().min(1, "Select start date"),
  endDate: z.string().min(1, "Select end date"),
  reason: z.string().optional(),
});

export default function LeavesPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("requests");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = new Date().getFullYear();

  const { data: leaves, isLoading: leavesLoading } = useListLeaves({ year });
  const { data: balances, isLoading: balancesLoading } = useGetLeaveBalances({ year });
  const { data: employees } = useListEmployees();
  const createLeave = useCreateLeave();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const deleteLeave = useDeleteLeave();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: any) => {
    createLeave.mutate({
      data: {
        employeeId: Number(data.employeeId),
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: "Leave request submitted" });
        setShowForm(false);
        reset();
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleApprove = (id: number) => {
    approveLeave.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalancesQueryKey() });
        toast({ title: "Leave approved" });
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const handleReject = (id: number) => {
    rejectLeave.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: "Leave rejected" });
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteLeave.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        toast({ title: "Leave request deleted" });
      },
    });
  };

  const filteredLeaves = (leaves ?? []).filter(l =>
    filterStatus === "all" ? true : l.status === filterStatus
  );

  const pendingCount = (leaves ?? []).filter(l => l.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground text-sm">
            {pendingCount > 0 ? `${pendingCount} pending approval` : "All caught up"}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-apply-leave">
          <Plus size={16} className="mr-1.5" />Apply Leave
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="requests" className="data-[state=active]:bg-background">
            Requests
            {pendingCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="balance" className="data-[state=active]:bg-background">Leave Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map(s => (
              <Button
                key={s}
                variant={filterStatus === s ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
                className="capitalize text-xs h-8"
              >
                {s}
                {s !== "all" && (
                  <span className="ml-1.5 opacity-70">
                    {(leaves ?? []).filter(l => l.status === s).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {leavesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : filteredLeaves.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No leave requests found.</div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredLeaves.map((leave, i) => {
                  const typeCfg = leaveTypeConfig[leave.type] || leaveTypeConfig.other;
                  const statusCfg = statusConfig[leave.status] || statusConfig.pending;
                  const initials = leave.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.div
                      key={leave.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card className="border-card-border shadow-sm hover:shadow-md transition-all" data-testid={`leave-card-${leave.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-semibold text-foreground">{leave.employeeName}</p>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeCfg.bg} ${typeCfg.color}`}>
                                  <typeCfg.icon size={11} />
                                  {leave.type.charAt(0).toUpperCase() + leave.type.slice(1)}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                  <statusCfg.icon size={11} />
                                  {statusCfg.label}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(leave.startDate), "d MMM")} — {format(new Date(leave.endDate), "d MMM yyyy")}
                                <span className="ml-2 font-medium text-foreground">{leave.days} day{leave.days !== 1 ? "s" : ""}</span>
                              </p>
                              {leave.reason && <p className="text-xs text-muted-foreground mt-1 truncate">{leave.reason}</p>}
                              {leave.approverNote && (
                                <p className="text-xs text-muted-foreground mt-1">Note: {leave.approverNote}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {leave.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(leave.id)}
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                                    disabled={approveLeave.isPending}
                                    data-testid={`button-approve-${leave.id}`}
                                  >
                                    <CheckCircle2 size={13} className="mr-1" />Approve
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(leave.id)}
                                    className="h-8 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs px-3"
                                    disabled={rejectLeave.isPending}
                                    data-testid={`button-reject-${leave.id}`}
                                  >
                                    <XCircle size={13} className="mr-1" />Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(leave.id)}
                                data-testid={`button-delete-leave-${leave.id}`}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          {balancesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
          ) : !balances?.length ? (
            <div className="text-center py-12 text-muted-foreground">No employees found.</div>
          ) : (
            <div className="grid gap-3">
              {balances.map((b, i) => {
                const initials = b.employeeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <motion.div
                    key={b.employeeId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="border-card-border shadow-sm" data-testid={`balance-card-${b.employeeId}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
                          </Avatar>
                          <p className="font-semibold text-foreground">{b.employeeName}</p>
                          <span className="text-xs text-muted-foreground ml-auto">{year}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { type: "Casual", used: b.casualUsed, total: b.casual, remaining: b.casualRemaining, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500" },
                            { type: "Sick", used: b.sickUsed, total: b.sick, remaining: b.sickRemaining, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500" },
                            { type: "Earned", used: b.earnedUsed, total: b.earned, remaining: b.earnedRemaining, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" },
                          ].map(lt => (
                            <div key={lt.type} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium ${lt.color}`}>{lt.type}</span>
                                <span className="text-xs text-muted-foreground">{lt.used}/{lt.total}</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${lt.bg}`}
                                  style={{ width: `${Math.min((lt.used / lt.total) * 100, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">{lt.remaining} remaining</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Apply Leave Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select onValueChange={v => setValue("employeeId", v)}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.employeeId && <p className="text-xs text-destructive">{String(errors.employeeId.message)}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select onValueChange={v => setValue("type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["casual", "sick", "earned", "maternity", "paternity", "other"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{String(errors.type.message)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From Date</Label>
                <Input type="date" data-testid="input-start-date" {...register("startDate")} />
                {errors.startDate && <p className="text-xs text-destructive">{String(errors.startDate.message)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input type="date" data-testid="input-end-date" {...register("endDate")} />
                {errors.endDate && <p className="text-xs text-destructive">{String(errors.endDate.message)}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input placeholder="Reason for leave..." data-testid="input-reason" {...register("reason")} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createLeave.isPending}>
                {createLeave.isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
