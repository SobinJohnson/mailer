"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-emerald-500 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-4 text-blue-500 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-amber-500 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-destructive shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-4 text-primary shrink-0 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg rounded-[12px] p-4 font-sans border flex gap-3 w-[360px]",
          description: "group-[.toast]:text-muted-foreground text-[12.5px] leading-relaxed mt-0.5",
          title: "font-semibold text-[13.5px] text-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
