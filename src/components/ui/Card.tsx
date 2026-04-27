import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-[14px] border border-border bg-card-bg ${className}`}>
      {children}
    </div>
  )
}
