import * as React from "react"
import { cn } from "../../lib/utils"

const Collapsible = ({ 
  open, 
  onOpenChange, 
  children 
}: { 
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = React.useState(open || false)
  
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open)
  }, [open])

  const handleToggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    onOpenChange?.(newState)
  }

  return (
    <div data-state={isOpen ? "open" : "closed"}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { open: isOpen, onToggle: handleToggle })
        }
        return child
      })}
    </div>
  )
}

const CollapsibleTrigger = ({ 
  children, 
  onClick,
  open,
  onToggle,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean; onToggle?: () => void }) => {
  return (
    <button
      onClick={(e) => {
        onClick?.(e)
        onToggle?.()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

const CollapsibleContent = ({ 
  children, 
  open,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { open?: boolean }) => {
  if (!open) return null
  
  return (
    <div 
      className={cn("overflow-hidden transition-all duration-200 ease-in-out", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
