import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    // Cycle with visible change from system based on effective theme
    const prefersDark = typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveDark = theme === "dark" || (theme === "system" && prefersDark);

    const next: "light" | "dark" | "system" =
      theme === "light" ? "dark" :
      theme === "dark" ? "system" :
      effectiveDark ? "light" : "dark";

    setTheme(next);
  };

  const isDark = (() => {
    const prefersDark = typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return theme === "dark" || (theme === "system" && prefersDark);
  })();
  return (
    <Button
      variant="outline"
      size="icon"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative rounded-full border-2 hover:border-primary transition-all"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
