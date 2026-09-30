import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("sina-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={toggleTheme}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className="border-brand-border bg-brand text-brand-foreground hover:bg-brand-panel hover:text-brand-foreground"
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
