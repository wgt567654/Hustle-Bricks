"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full size-10"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <span className="material-symbols-outlined text-[20px] dark:hidden">
        light_mode
      </span>
      <span className="material-symbols-outlined text-[20px] hidden dark:block">
        dark_mode
      </span>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
