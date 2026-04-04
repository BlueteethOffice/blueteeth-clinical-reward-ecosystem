'use client';

import * as React from "react"
import { ChevronDown } from "lucide-react"

const Select = ({ children, onValueChange, value }: { children: any, onValueChange: any, value: string }) => {
  return (
    <div className="relative w-full">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (typeof child.type === 'string') return child;
        return React.cloneElement(child as React.ReactElement<any>, { onValueChange, value });
      })}
    </div>
  )
}

const SelectTrigger = ({ children, className }: { children: any, className?: string }) => {
  return (
    <div className={`flex items-center justify-between h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium ${className}`}>
      {children}
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </div>
  )
}

const SelectValue = ({ placeholder, value }: { placeholder: string, value?: string }) => {
  return <span className={!value ? "text-slate-400 font-medium" : "text-slate-900 font-bold truncate pr-2"}>{value || placeholder}</span>
}

const SelectContent = ({ children, onValueChange, value }: { children: any, onValueChange?: any, value?: string }) => {
  return (
    <div className="absolute top-full left-0 z-[100] w-full mt-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl shadow-blue-900/10 animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5">
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          if (typeof child.type === 'string') return child;
          return React.cloneElement(child as React.ReactElement<any>, { 
            onClick: () => (onValueChange && (child.props as any).value) ? onValueChange((child.props as any).value) : undefined, 
            active: (child.props as any).value === value 
          });
        })}
      </div>
    </div>
  )
}

const SelectItem = ({ children, value, onClick, className, active }: { children: any, value: string, onClick?: any, className?: string, active?: boolean }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-3 px-4 text-sm outline-none hover:bg-blue-50 hover:text-blue-600 transition-all font-bold ${active ? 'bg-blue-100 text-blue-700' : 'text-slate-700'} ${className}`}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
