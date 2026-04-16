import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  getListEmployeesQueryKey,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, Phone, Building2, Calendar, DollarSign } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(10, "Enter valid phone"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().min(2, "Role required"),
  department: z.string().optional(),
  salary: z.string().min(1, "Salary required"),
  salaryType: z.string().min(1, "Select salary type"),
  joiningDate: z.string().min(1, "Joining date required"),
});

type EmployeeForm = z.infer<typeof schema>;

const roleColors: Record<string, string> = {
  Developer: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Designer: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  HR: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<EmployeeForm>({
    resolver: zodResolver(schema),
    defaultValues: { salaryType: "monthly" },
  });

  const openCreate = () => {
    setEditingEmployee(null);
    reset({ salaryType: "monthly", joiningDate: new Date().toISOString().split("T")[0] });
    setShowForm(true);
  };

  const openEdit = (emp: any) => {
    setEditingEmployee(emp);
    reset({
      name: emp.name,
      phone: emp.phone,
      email: emp.email || "",
      role: emp.role,
      department: emp.department || "",
      salary: String(emp.salary),
      salaryType: emp.salaryType,
      joiningDate: emp.joiningDate,
    });
    setShowForm(true);
  };

  const onSubmit = (data: EmployeeForm) => {
    const payload = {
      ...data,
      salary: Number(data.salary),
      email: data.email || null,
      department: data.department || null,
    };

    if (editingEmployee) {
      updateEmployee.mutate({ id: editingEmployee.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          toast({ title: "Employee updated" });
          setShowForm(false);
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      });
    } else {
      createEmployee.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          toast({ title: "Employee added" });
          setShowForm(false);
          reset();
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEmployee.mutate({ id: deleteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({ title: "Employee removed" });
        setDeleteId(null);
      },
      onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
    });
  };

  const filtered = (employees ?? []).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.phone.includes(search) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground text-sm">{(employees ?? []).length} team members</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-employee">
          <Plus size={16} className="mr-2" /> Add Employee
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search"
        />
      </div>

      {/* Employee list */}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No employees found</p>
          <Button variant="outline" onClick={openCreate} className="mt-4">Add your first employee</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {filtered.map((emp, i) => {
              const roleColor = roleColors[emp.role] || roleColors.default;
              const initials = emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  data-testid={`card-employee-${emp.id}`}
                >
                  <Card className="border-card-border shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{emp.name}</p>
                            <Badge className={`text-xs px-2 py-0 ${roleColor}`}>{emp.role}</Badge>
                            <Badge variant={emp.status === "active" ? "default" : "secondary"} className="text-xs px-2 py-0">
                              {emp.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            {emp.department && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 size={11} />{emp.department}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone size={11} />{emp.phone}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <DollarSign size={11} />₹{Number(emp.salary).toLocaleString("en-IN")}/{emp.salaryType === "monthly" ? "mo" : "day"}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar size={11} />Joined {emp.joiningDate}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)} data-testid={`button-edit-employee-${emp.id}`}>
                            <Edit2 size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(emp.id)} data-testid={`button-delete-employee-${emp.id}`}>
                            <Trash2 size={15} />
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

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="Priya Patel" data-testid="input-name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="9876543210" data-testid="input-phone" {...register("phone")} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email (optional)</Label>
                <Input type="email" placeholder="priya@company.com" data-testid="input-email" {...register("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Input placeholder="Developer" data-testid="input-role" {...register("role")} />
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="Engineering" data-testid="input-department" {...register("department")} />
              </div>
              <div className="space-y-1.5">
                <Label>Salary (₹)</Label>
                <Input type="number" placeholder="50000" data-testid="input-salary" {...register("salary")} />
                {errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Salary Type</Label>
                <Select defaultValue={editingEmployee?.salaryType || "monthly"} onValueChange={v => setValue("salaryType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Joining Date</Label>
                <Input type="date" data-testid="input-joining-date" {...register("joiningDate")} />
                {errors.joiningDate && <p className="text-xs text-destructive">{errors.joiningDate.message}</p>}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createEmployee.isPending || updateEmployee.isPending}>
                {editingEmployee ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this employee and all their records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
