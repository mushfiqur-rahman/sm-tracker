"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const KEY = "pp-theme";
const EVENT = "pp-theme-change";

function read(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => read() === "system" && apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(t: Theme) {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked: still apply for this page view */
    }
    apply(t);
    window.dispatchEvent(new Event(EVENT));
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={cn("rounded-md p-1.5 text-subtle transition-colors hover:text-fg", theme === value && "bg-muted text-fg")}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
