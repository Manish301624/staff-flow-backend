import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Moon, Sun, Laptop, Check } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const initials = user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "SF";

  const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      {/* Profile Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize font-medium">{user?.role}</span>
                  <span className="text-xs text-muted-foreground">{user?.companyName}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your preferred color theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {themeOptions.map(opt => {
                const isActive = theme === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setTheme(opt.value)}
                    className={`relative flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"}`}
                    data-testid={`button-theme-${opt.value}`}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <opt.icon size={20} className={isActive ? "text-primary" : "text-muted-foreground"} />
                    <span className={`text-sm font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Demo info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Demo Credentials</CardTitle>
            <CardDescription>Use these to log in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">Email:</span>
                <span className="text-foreground font-medium">admin@staffflow.com</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">Password:</span>
                <span className="text-foreground font-medium">password123</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-card-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">StaffFlow</p>
                <p className="text-xs text-muted-foreground">Employee Attendance & Salary Management</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">v1.0.0</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
