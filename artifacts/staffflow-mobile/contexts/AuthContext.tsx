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
  employeeId?: number; // Added to prevent TypeScript errors if payload structure bleeds through
  adminId?: number;
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
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    if (Platform.OS === "web") {
      const jsonPayload = decodeURIComponent(
        globalThis.atob(padded)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } else {
      const jsonPayload = globalThis.atob(padded);
      return JSON.parse(jsonPayload);
    }
  } catch (error) {
    console.error("JWT Decode failed critically:", error);
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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && bootstrapDone.current && !user) {
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

    const savedUser = await loadUser();
    if (savedUser) {
      setUser(savedUser);
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

      if (!payload || isTokenExpired(payload)) {
        await deleteToken();
        setUser(null);
        setIsLoading(false);
        bootstrapDone.current = true;
        return;
      }

      // 1. Always try loading completely preserved object from storage first
      const savedUser = await loadUser();

      if (savedUser && savedUser.role) {
        setUser(savedUser);
        setIsLoading(false);
        bootstrapDone.current = true;

        // Background sync for Admins only
        if (savedUser.role !== "employee") {
          getMe().then(async (freshData) => {
            setUser(freshData as AuthUser);
            await saveUser(freshData as AuthUser);
          }).catch(() => console.log("Silent admin refresh failed"));
        }
        return;
      }

      // 2. Fallback execution if savedUser is corrupted/missing but token is alive
      if (payload.role === "employee") {
        const empUser: AuthUser = {
          id: Number(payload.employeeId || payload.id || 0),
          name: payload.name || "Employee",
          email: payload.email || "",
          role: "employee",
          companyName: payload.companyName || "My Company",
          createdAt: payload.createdAt || new Date().toISOString(),
          employeeId: Number(payload.employeeId || payload.id || 0),
          adminId: payload.adminId ? Number(payload.adminId) : undefined
        };
        setUser(empUser);
        await saveUser(empUser);
      } else {
        const userData = await getMe();
        setUser(userData as AuthUser);
        await saveUser(userData as AuthUser);
      }

    } catch (e) {
      console.warn("Bootstrap structural error:", e);
    } finally {
      setIsLoading(false);
      bootstrapDone.current = true;
    }
  }

  const login = async (token: string, userData: AuthUser) => {
    const tokenStr = typeof token === "string" ? token : String(token);

    // Normalize data schema structure before sending to storage
    const normalizedUser: AuthUser = {
      ...userData,
      id: Number(userData.id || userData.employeeId || 0),
      role: userData.role || "employee",
      companyName: userData.companyName || "StaffFlow Org",
      createdAt: userData.createdAt || new Date().toISOString()
    };

    await saveToken(tokenStr);
    await saveUser(normalizedUser);
    setAuthTokenGetter(async () => tokenStr);
    setUser(normalizedUser);
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