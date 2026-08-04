import * as React from "react"
import { cn } from "../../lib/utils"

const TooltipContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      {children}
    </TooltipContext.Provider>
  )
}

const Tooltip = ({ children, content, delayDuration = 200 }: { 
  children: React.ReactNode
  content: React.ReactNode
  delayDuration?: number
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const show = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(true), delayDuration)
  }

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(false)
  }

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {isOpen && (
        <div className="absolute z-50 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 rounded-md shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
          {content}
        </div>
      )}
    </div>
  )
}

const TooltipTrigger = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const TooltipContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn("z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md", className)}>{children}</div>
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
