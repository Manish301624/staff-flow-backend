
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { setAuthTokenGetter, getMe } from "@workspace/api-client-react";

const TOKEN_KEY = "staffflow_token";

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

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

function decodeToken(token: string): any {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(async () => loadToken());

    async function bootstrap() {
      const token = await loadToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Decode token to check role
      const payload = decodeToken(token);

      if (!payload) {
        await deleteToken();
        setIsLoading(false);
        return;
      }

      // Check token expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        await deleteToken();
        setIsLoading(false);
        return;
      }

      if (payload.role === "employee") {
        // Employee token — restore from token payload directly
        setUser({
          id: payload.employeeId,
          name: payload.name || "",
          email: payload.email,
          role: "employee",
          companyName: "",
          createdAt: new Date().toISOString(),
          employeeId: payload.employeeId,
          adminId: payload.adminId,
        } as any);
        setIsLoading(false);
      } else {
        // Admin token — use getMe()
        try {
          const userData = await getMe();
          setUser(userData as AuthUser);
        } catch {
          await deleteToken();
        } finally {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
  }, []);

  const login = async (token: string, userData: AuthUser) => {
    const tokenStr = typeof token === "string" ? token : String(token);
    await saveToken(tokenStr);
    setAuthTokenGetter(async () => tokenStr);
    setUser(userData);
  };

  const logout = async () => {
    await deleteToken();
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
