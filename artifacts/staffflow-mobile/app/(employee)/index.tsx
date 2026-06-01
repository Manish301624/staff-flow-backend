import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
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

async function saveUser(user: AuthUser) {
  const json = JSON.stringify(user);
  if (Platform.OS === "web") {
    localStorage.setItem(USER_KEY, json);
  } else {
    await SecureStore.setItemAsync(USER_KEY, json);
  }
}

async function loadUser(): Promise<AuthUser | null> {
  try {
    const json = Platform.OS === "web"
      ? localStorage.getItem(USER_KEY)
      : await SecureStore.getItemAsync(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

async function deleteUser() {
  if (Platform.OS === "web") {
    localStorage.removeItem(USER_KEY);
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
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
         try {
           const savedUser = await loadUser();
           if (savedUser) {
             setUser(savedUser);
             setIsLoading(false);
             // Only verify token for admins in background
             if (savedUser.role !== "employee") {
               try {
                 const freshUser = await getMe();
                 setUser(freshUser as AuthUser);
                 await saveUser(freshUser as AuthUser);
               } catch {
                 await deleteToken();
                 await deleteUser();
                 setUser(null);
               }
             }
             return;
           }
           // No saved user — admin fallback
           const userData = await getMe();
           setUser(userData as AuthUser);
           await saveUser(userData as AuthUser);
           setIsLoading(false);
         } catch {
           await deleteToken();
           await deleteUser();
           setIsLoading(false);
         }
       }

    bootstrap();
  }, []);

  const login = async (token: string, userData: AuthUser) => {
    await saveToken(token);
    await saveUser(userData);
    setAuthTokenGetter(async () => token);
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
