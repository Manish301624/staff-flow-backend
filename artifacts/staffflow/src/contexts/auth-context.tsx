import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getMe } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getToken, clearToken, setToken } from "@/lib/auth";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  companyName: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());

    async function loadUser() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await getMe();
        setUser(userData as User);
      } catch {
        clearToken();
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = (token: string, userData: User) => {
    setToken(token);
    setAuthTokenGetter(() => getToken());
    setUser(userData);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
