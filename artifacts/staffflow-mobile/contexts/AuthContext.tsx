import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform, AppState } from "react-native";
import { setAuthTokenGetter, getMe } from "@workspace/api-client-react";

const TOKEN_KEY = "staffflow_token";
const USER_KEY = "staffflow_user";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companyName: string;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Storage helpers ───────────────────────────────────────────────────────
async function saveToken(token: string) {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (e) {
    console.warn("saveToken error:", e);
  }
}

async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) {
    console.warn("loadToken error:", e);
    return null;
  }
}

async function deleteToken() {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (e) {
    console.warn("deleteToken error:", e);
  }
}

async function saveUser(user: AuthUser) {
  try {
    const str = JSON.stringify(user);
    if (Platform.OS === "web") {
      localStorage.setItem(USER_KEY, str);
    } else {
      await SecureStore.setItemAsync(USER_KEY, str);
    }
  } catch (e) {
    console.warn("saveUser error:", e);
  }
}

async function loadUser(): Promise<AuthUser | null> {
  try {
    let str: string | null = null;
    if (Platform.OS === "web") {
      str = localStorage.getItem(USER_KEY);
    } else {
      str = await SecureStore.getItemAsync(USER_KEY);
    }
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

// ─── Token decode ──────────────────────────────────────────────────────────
function decodeToken(token: string): any {
  try {
    const base64 = token.split(".")[1];
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpired(payload: any): boolean {
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
}

// ─── Context ───────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapDone = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(async () => loadToken());
    bootstrap();
  }, []);

  // Prevent logout on app state change (background/foreground)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && bootstrapDone.current && !user) {
        // Re-check token silently when app comes to foreground
        silentRestore();
      }
    });
    return () => sub.remove();
  }, [user]);

    async function silentRestore() {
      const token = await loadToken();
      if (!token) return;

      const payload = decodeToken(token);
      if (!payload || isTokenExpired(payload)) return;

      // ✅ Same fix here
      const isEmployee = payload.role === "employee" || !!payload.employeeId;
      if (isEmployee) {
        const savedUser = await loadUser();
        if (savedUser) setUser(savedUser);
      }
    }

    async function bootstrap() {
      try {
        const token = await loadToken();
        if (!token) {
          setIsLoading(false);
          bootstrapDone.current = true;
          return;
        }

        const payload = decodeToken(token);

        if (!payload) {
          await deleteToken();
          setIsLoading(false);
          bootstrapDone.current = true;
          return;
        }

        if (isTokenExpired(payload)) {
          await deleteToken();
          setIsLoading(false);
          bootstrapDone.current = true;
          return;
        }

        // ✅ Check BOTH role AND employeeId — employee tokens may not carry role field
        const isEmployee = payload.role === "employee" || !!payload.employeeId;

        if (isEmployee) {
          // Try saved user first
          const savedUser = await loadUser();
          if (savedUser && (savedUser.role === "employee" || (savedUser as any).employeeId)) {
            setUser(savedUser);
            setIsLoading(false);
            bootstrapDone.current = true;
            return;
          }

          // Fallback: rebuild from token payload
          const empUser = {
            id: payload.employeeId ?? payload.id,
            name: payload.name || "",
            email: payload.email || "",
            role: "employee",
            companyName: "",
            createdAt: new Date().toISOString(),
            employeeId: payload.employeeId ?? payload.id,
            adminId: payload.adminId,
          } as any;
          setUser(empUser);
          await saveUser(empUser);
          setIsLoading(false);
          bootstrapDone.current = true;

        } else {
          // Admin — use getMe()
          try {
            const userData = await getMe();
            setUser(userData as AuthUser);
            await saveUser(userData as AuthUser);
          } catch {
            // ✅ Don't delete token blindly — only delete if truly unauthorized
            await deleteToken();
          } finally {
            setIsLoading(false);
            bootstrapDone.current = true;
          }
        }
      } catch (e) {
        console.warn("bootstrap error:", e);
        setIsLoading(false);
        bootstrapDone.current = true;
      }
    }

  const login = async (token: string, userData: AuthUser) => {
    const tokenStr = typeof token === "string" ? token : String(token);
    await saveToken(tokenStr);
    await saveUser(userData);
    setAuthTokenGetter(async () => tokenStr);
    setUser(userData);
  };

  const logout = async () => {
    await deleteToken();
    setAuthTokenGetter(async () => null);
    setUser(null);
    bootstrapDone.current = false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
