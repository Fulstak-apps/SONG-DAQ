"use client";
import { useEffect } from "react";
import { useUI } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUI();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
