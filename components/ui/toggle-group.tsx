import * as React from "react"
import { Toggle } from "./toggle"
import { cn } from "../../lib/utils"

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
  type?: "single" | "multiple"
}

const ToggleGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
  type?: "single" | "multiple"
} | null>(null)

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, value, onValueChange, type = "single", children, ...props }, ref) => {
    return (
      <ToggleGroupContext.Provider value={{ value, onValueChange, type }}>
        <div ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props}>
          {children}
        </div>
      </ToggleGroupContext.Provider>
    )
  }
)
ToggleGroup.displayName = "ToggleGroup"

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)
    const isSelected = context?.type === "single" ? context?.value === value : false
    
    const handleClick = () => {
      if (context?.type === "single") {
        context?.onValueChange?.(isSelected ? "" : value)
      }
    }

    return (
      <Toggle
        ref={ref}
        pressed={isSelected}
        onPressedChange={handleClick}
        className={cn(
          "min-w-[3rem]",
          className
        )}
        {...props}
      >
        {children}
      </Toggle>
    )
  }
)
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
