import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useListEmployees,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Trash2, Edit2 } from "lucide-react";

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Circle, color: "text-muted-foreground", label: "Pending" },
  in_progress: { icon: Clock, color: "text-blue-500", label: "In Progress" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
  overdue: { icon: AlertTriangle, color: "text-red-500", label: "Overdue" },
};

const priorityColor: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const schema = z.object({
  title: z.string().min(2, "Task title required"),
  description: z.string().optional(),
  priority: z.string().min(1),
  status: z.string().min(1),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});

export default function TasksPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks();
  const { data: employees } = useListEmployees();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium", status: "pending" },
  });

  const openCreate = () => {
    setEditingTask(null);
    reset({ priority: "medium", status: "pending" });
    setShowForm(true);
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedTo ? String(task.assignedTo) : "",
      dueDate: task.dueDate || "",
    });
    setShowForm(true);
  };

  const onSubmit = (data: any) => {
    const payload = {
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assignedTo ? Number(data.assignedTo) : null,
      dueDate: data.dueDate || null,
    };

    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task updated" });
          setShowForm(false);
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      });
    } else {
      createTask.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task created" });
          setShowForm(false);
          reset();
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      });
    }
  };

  const handleComplete = (task: any) => {
    updateTask.mutate({ id: task.id, data: { ...task, status: "completed" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() }),
    });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Task deleted" });
      },
    });
  };

  const filtered = (tasks ?? []).filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const grouped = {
    pending: filtered.filter(t => t.status === "pending"),
    in_progress: filtered.filter(t => t.status === "in_progress"),
    completed: filtered.filter(t => t.status === "completed"),
    overdue: filtered.filter(t => t.status === "overdue"),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} tasks total</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-task">
          <Plus size={16} className="mr-1.5" />New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No tasks yet. Create one to get started.</div>
      ) : (
        <div className="space-y-4">
          {(["overdue", "in_progress", "pending", "completed"] as const).map(status => {
            const group = grouped[status];
            if (!group.length) return null;
            const cfg = statusConfig[status];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <cfg.icon size={15} className={cfg.color} />
                  <span className="text-sm font-semibold text-foreground">{cfg.label}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{group.length}</Badge>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {group.map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card className={`border-card-border shadow-sm hover:shadow-md transition-all ${task.status === "completed" ? "opacity-60" : ""}`} data-testid={`task-card-${task.id}`}>
                          <CardContent className="p-3.5">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => task.status !== "completed" && handleComplete(task)}
                                className="mt-0.5 shrink-0"
                                data-testid={`button-complete-${task.id}`}
                              >
                                {task.status === "completed" ? (
                                  <CheckCircle2 size={18} className="text-emerald-500" />
                                ) : (
                                  <Circle size={18} className="text-muted-foreground hover:text-primary transition-colors" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                    {task.title}
                                  </p>
                                  <Badge className={`text-xs px-1.5 py-0 capitalize ${priorityColor[task.priority] || ""}`}>{task.priority}</Badge>
                                </div>
                                {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                                <div className="flex items-center gap-3 mt-1">
                                  {task.assignedToName && <span className="text-xs text-muted-foreground">{task.assignedToName}</span>}
                                  {task.dueDate && (
                                    <span className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== "completed" ? "text-red-500" : "text-muted-foreground"}`}>
                                      Due {format(new Date(task.dueDate), "d MMM")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}>
                                  <Edit2 size={13} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Task Title</Label>
              <Input placeholder="Complete payroll for April" data-testid="input-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{String(errors.title.message)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Optional details..." data-testid="input-description" {...register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select defaultValue={editingTask?.priority || "medium"} onValueChange={v => setValue("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select defaultValue={editingTask?.status || "pending"} onValueChange={v => setValue("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select defaultValue={editingTask?.assignedTo ? String(editingTask.assignedTo) : ""} onValueChange={v => setValue("assignedTo", v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {(employees ?? []).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" data-testid="input-due-date" {...register("dueDate")} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createTask.isPending || updateTask.isPending}>
                {editingTask ? "Save" : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
