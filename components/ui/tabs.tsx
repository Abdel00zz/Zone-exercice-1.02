import * as React from "react"
import { cn } from "../../lib/utils"

const Tabs = ({ value, onValueChange, children, className }: { 
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) => {
  const [activeTab, setActiveTab] = React.useState(value || "")
  
  React.useEffect(() => {
    if (value !== undefined) setActiveTab(value)
  }, [value])

  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue)
    onValueChange?.(newValue)
  }

  return (
    <div className={cn("w-full", className)} data-value={activeTab}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { value: activeTab, onValueChange: handleTabChange })
        }
        return child
      })}
    </div>
  )
}

const TabsList = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )} 
    {...props}
  >
    {children}
  </div>
)

const TabsTrigger = ({ 
  value, 
  className, 
  children, 
  onClick,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
  const context = React.useContext(TabsContext)
  const isActive = context?.value === value
  
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        context?.onValueChange?.(value)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

const TabsContext = React.createContext<{ value: string; onValueChange: (value: string) => void } | null>(null)

const TabsContent = ({ 
  value, 
  className, 
  children, 
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
  const context = React.useContext(TabsContext)
  const isActive = context?.value === value
  
  if (!isActive) return null
  
  return (
    <div
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
