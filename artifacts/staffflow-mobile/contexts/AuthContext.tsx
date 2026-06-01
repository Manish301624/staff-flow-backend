import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { setAuthTokenGetter, getMe } from "@workspace/api-client-react";

const TOKEN_KEY = "staffflow_token";
const USER_KEY  = "staffflow_user";

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

// ─── Token storage (SecureStore — encrypted, for sensitive auth token) ─────
async function saveToken(token: string) {
  try {
    if (Platform.OS === "web") localStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (e) { console.warn("saveToken error:", e); }
}

async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) { console.warn("loadToken error:", e); return null; }
}

async function deleteToken() {
  try {
    if (Platform.OS === "web") localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (e) { console.warn("deleteToken error:", e); }
}

// ─── User storage (AsyncStorage — reliable persistence, no size limit) ─────
async function saveUser(user: AuthUser) {
  try {
    const str = JSON.stringify(user);
    if (Platform.OS === "web") localStorage.setItem(USER_KEY, str);
    else await AsyncStorage.setItem(USER_KEY, str);
  } catch (e) { console.warn("saveUser error:", e); }
}

async function loadUser(): Promise<AuthUser | null> {
  try {
    if (Platform.OS === "web") {
      const str = localStorage.getItem(USER_KEY);
      return str ? JSON.parse(str) : null;
    }
    const str = await AsyncStorage.getItem(USER_KEY);
    return str ? JSON.parse(str) : null;
  } catch { return null; }
}

async function deleteUser() {
  try {
    if (Platform.OS === "web") localStorage.removeItem(USER_KEY);
    else await AsyncStorage.removeItem(USER_KEY);
  } catch (e) { console.warn("deleteUser error:", e); }
}

// ─── Token decode (employee fallback) ─────────────────────────────────────
function decodeToken(token: string): any {
  try {
    const base64 = token.split(".")[1];
    const padded  = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

// ─── Context ───────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(async () => loadToken());
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const token = await loadToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // ── Step 1: Restore from AsyncStorage (works for both admin & employee) ──
      const savedUser = await loadUser();
      if (savedUser) {
        setUser(savedUser);
        setIsLoading(false);

        // Admin only: verify token in background
        // Employee skipped — no /api/auth/me endpoint
        if (savedUser.role !== "employee") {
          try {
            const freshUser = await getMe();
            setUser(freshUser as AuthUser);
            await saveUser(freshUser as AuthUser);
          } catch (err: any) {
            const status = err?.status ?? err?.response?.status ?? err?.statusCode;
            if (status === 401 || status === 403) {
              await deleteToken();
              await deleteUser();
              setUser(null);
            }
            // Network error → keep existing user, don't logout
          }
        }
        return;
      }

      // ── Step 2: No savedUser — try getMe() (admin first login) ──
      try {
        const userData = await getMe();
        setUser(userData as AuthUser);
        await saveUser(userData as AuthUser);
        setIsLoading(false);
      } catch {
        // ── Step 3: getMe() failed — decode JWT as employee fallback ──
        const payload = decodeToken(token);
        if (payload && payload.role === "employee") {
          const empUser: any = {
            id:          payload.employeeId ?? payload.id,
            name:        payload.name       ?? "",
            email:       payload.email      ?? "",
            role:        "employee",
            companyName: "",
            createdAt:   new Date().toISOString(),
            employeeId:  payload.employeeId ?? payload.id,
            adminId:     payload.adminId    ?? null,
            department:  payload.department ?? null,
          };
          setUser(empUser);
          await saveUser(empUser); // persists for next restart → hits Step 1
        } else {
          // Admin token but getMe() failed — genuine auth failure
          await deleteToken();
          await deleteUser();
        }
        setIsLoading(false);
      }

    } catch (e) {
      console.warn("bootstrap error:", e);
      setIsLoading(false);
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
    await deleteUser();
    setAuthTokenGetter(async () => null);
    setUser(null);
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