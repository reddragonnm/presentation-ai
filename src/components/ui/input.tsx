import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "borderless"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base input styles
          "flex w-full px-4 py-3 text-sm text-foreground placeholder:text-secondary",
          
          // Variant-specific styles
          variant === "default" && "rounded-xl border border-border bg-background",
          variant === "borderless" && "border-none bg-transparent",
          
          // Focus and interaction states
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          
          // File input specific styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          
          // Additional custom classes
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
