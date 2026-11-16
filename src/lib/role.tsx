import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "creator" | "reviewer";

const RoleContext = createContext<{ role: Role; setRole: (r: Role) => void }>({
  role: "creator",
  setRole: () => {},
});

const KEY = "brandlens-role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("creator");
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "creator" || saved === "reviewer") setRoleState(saved);
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    window.localStorage.setItem(KEY, r);
  };
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
