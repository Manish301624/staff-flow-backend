import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform, AppState } from "react-native";
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

// ─── Storage helpers ───────────────────────────────────────────────────────
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

// ✅ deleteToken no longer wipes USER_KEY — they are managed separately
async function deleteToken() {
  try {
    if (Platform.OS === "web") localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (e) { console.warn("deleteToken error:", e); }
}

async function saveUser(user: AuthUser) {
  try {
    const str = JSON.stringify(user);
    if (Platform.OS === "web") localStorage.setItem(USER_KEY, str);
    else await SecureStore.setItemAsync(USER_KEY, str);
  } catch (e) { console.warn("saveUser error:", e); }
}

async function loadUser(): Promise<AuthUser | null> {
  try {
    const str = Platform.OS === "web"
      ? localStorage.getItem(USER_KEY)
      : await SecureStore.getItemAsync(USER_KEY);
    return str ? JSON.parse(str) : null;
  } catch { return null; }
}

async function deleteUser() {
  try {
    if (Platform.OS === "web") localStorage.removeItem(USER_KEY);
    else await SecureStore.deleteItemAsync(USER_KEY);
  } catch (e) { console.warn("deleteUser error:", e); }
}

// ─── Token decode ──────────────────────────────────────────────────────────
function decodeToken(token: string): any {
  try {
    const base64 = token.split(".")[1];
    const padded  = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

function isTokenExpired(payload: any): boolean {
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
}

// ✅ Detects employee token using every possible field your backend might use
function isEmployeeToken(payload: any): boolean {
  if (!payload) return false;
  return (
    payload.role       === "employee" ||
    payload.type       === "employee" ||
    payload.userType   === "employee" ||
    payload.user_type  === "employee" ||
    !!payload.employeeId              ||
    !!payload.employee_id
  );
}

// ─── Context ───────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootstrapDone = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(async () => loadToken());
    bootstrap();
  }, []);

  // Re-check when app comes back to foreground
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
    console.warn("🔍 JWT payload:", JSON.stringify(payload));
    if (!payload || isTokenExpired(payload)) return;

    // For employee: always restore from saved user, never call getMe()
    if (isEmployeeToken(payload)) {
      const savedUser = await loadUser();
      if (savedUser) setUser(savedUser);
    }
  }

  async function bootstrap() {
    try {
      const token = await loadToken();

      // No token — show login
      if (!token) {
        setIsLoading(false);
        bootstrapDone.current = true;
        return;
      }

      const payload = decodeToken(token);

      // Corrupt token
      if (!payload) {
        await deleteToken();
        await deleteUser();
        setIsLoading(false);
        bootstrapDone.current = true;
        return;
      }

      // Expired token
      if (isTokenExpired(payload)) {
        await deleteToken();
        await deleteUser();
        setIsLoading(false);
        bootstrapDone.current = true;
        return;
      }

      if (isEmployeeToken(payload)) {
        // ── Employee path: NEVER call getMe() ──────────────────────────────

        // 1. Try saved user (survives tab close on web)
        const savedUser = await loadUser();
        if (savedUser && (savedUser.role === "employee" || (savedUser as any).employeeId)) {
          setUser(savedUser);
          setIsLoading(false);
          bootstrapDone.current = true;
          return;
        }

        // 2. Rebuild from JWT payload fields
        const empUser: any = {
          id:         payload.employeeId ?? payload.employee_id ?? payload.id ?? 0,
          name:       payload.name       ?? payload.username ?? "",
          email:      payload.email      ?? "",
          role:       "employee",
          companyName:"",
          createdAt:  new Date().toISOString(),
          employeeId: payload.employeeId ?? payload.employee_id ?? payload.id ?? 0,
          adminId:    payload.adminId    ?? payload.admin_id,
          department: payload.department ?? "",
        };
        setUser(empUser);
        await saveUser(empUser);
        setIsLoading(false);
        bootstrapDone.current = true;

      } else {
        // ── Admin path: verify via getMe() ─────────────────────────────────
        try {
          const userData = await getMe();
          setUser(userData as AuthUser);
          await saveUser(userData as AuthUser);
        } catch (err: any) {
          // Only wipe session on actual 401 Unauthorized
          const status = err?.status ?? err?.response?.status;
          if (status === 401 || status === 403) {
            await deleteToken();
            await deleteUser();
          } else {
            // Network error / server down — restore from saved user
            const savedUser = await loadUser();
            if (savedUser) setUser(savedUser);
          }
        } finally {
          setIsLoading(false);
          bootstrapDone.current = true;
        }
      }
    } catch (e) {
      console.warn("bootstrap error:", e);
      // Last resort: try saved user before giving up
      const savedUser = await loadUser();
      if (savedUser) setUser(savedUser);
      setIsLoading(false);
      bootstrapDone.current = true;
    }
  }

  const login = async (token: string, userData: AuthUser) => {
    const tokenStr = typeof token === "string" ? token : String(token);
    await saveToken(tokenStr);
    await saveUser(userData);                      // ← persist user immediately
    setAuthTokenGetter(async () => tokenStr);
    setUser(userData);
  };

  const logout = async () => {
    await deleteToken();
    await deleteUser();
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