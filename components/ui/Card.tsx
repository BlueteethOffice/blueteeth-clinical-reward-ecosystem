import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'flat' | 'outline' | 'glass';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', children, ...props }, ref) => {
    const variants = {
      elevated: 'bg-white shadow-sm ring-1 ring-slate-900/5',
      flat: 'bg-slate-50 border border-slate-100',
      outline: 'bg-transparent border border-slate-200',
      glass: 'bg-white/70 backdrop-blur-xl ring-1 ring-slate-900/10',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl overflow-hidden transition-all duration-300',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };

export const CardHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 sm:p-6 border-b border-slate-50', className)} {...props}>
    {children}
  </div>
);

export const CardContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 sm:p-6', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 sm:px-6 py-4 bg-slate-50/50 border-t border-slate-50', className)} {...props}>
    {children}
  </div>
);
