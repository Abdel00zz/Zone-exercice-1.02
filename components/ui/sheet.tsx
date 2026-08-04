import * as React from "react"
import { cn } from "../../lib/utils"

const Sheet = React.createContext<{ state: "open" | "closed"; close: () => void } | null>(null)

// Note: This is a simplified version. For full functionality, use @radix-ui/react-dialog with side variants
const SheetTrigger = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button onClick={onClick}>{children}</button>
)

const SheetContent = ({ 
  side = "right", 
  className, 
  children,
  onClose
}: { 
  side?: "left" | "right" | "top" | "bottom"
  className?: string
  children: React.ReactNode
  onClose?: () => void
}) => {
  const sideClasses = {
    left: "left-0 top-0 h-full w-3/4 border-r",
    right: "right-0 top-0 h-full w-3/4 border-l",
    top: "top-0 left-0 w-full h-1/2 border-b",
    bottom: "bottom-0 left-0 w-full h-1/2 border-t",
  }

  return (
    <div className={cn(
      "fixed z-50 bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out",
      sideClasses[side],
      className
    )}>
      <button 
        onClick={onClose}
        className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
      >
        ✕
      </button>
      {children}
    </div>
  )
}

export { Sheet, SheetTrigger, SheetContent }
