import { createContext, useContext } from "react";

// Lowercase latin, digits, CJK/kana/hangul, - and _; no path characters, so a
// valid username is safe to use as a folder name on the server
const USERNAME_RE =
  /^[a-z0-9_\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}-]{1,32}$/u;

export const isValidUsername = (username: string) => USERNAME_RE.test(username);

export type UserContextValue = {
  user: string | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
};

export const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
