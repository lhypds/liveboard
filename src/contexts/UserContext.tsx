import { useEffect, useState, type ReactNode } from "react";
import * as api from "@utils/user";
import { UserContext, isValidUsername } from "./user";

const KEY = "liveboard:user";

export default function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => {
    const stored = localStorage.getItem(KEY);
    return stored && isValidUsername(stored) ? stored : null;
  });

  // Re-ensure the restored user's folder on the server; it may have been
  // wiped between deploys
  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored && isValidUsername(stored)) api.login(stored).catch(() => {});
  }, []);

  const login = async (username: string) => {
    await api.login(username);
    localStorage.setItem(KEY, username);
    setUser(username);
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    setUser(null);
  };

  return <UserContext.Provider value={{ user, login, logout }}>{children}</UserContext.Provider>;
}
