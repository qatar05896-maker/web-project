import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

interface AuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  setToken: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem("token"),
  );
  const queryClient = useQueryClient();

  const setToken = (t: string | null) => {
    if (t) {
      localStorage.setItem("token", t);
    } else {
      localStorage.removeItem("token");
    }
    setTokenState(t);
  };

  const logout = () => {
    setToken(null);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
