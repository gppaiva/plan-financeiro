import type { ReactNode } from 'react'

type BadgeVariant = 'blue' | 'purple' | 'green' | 'orange'

interface BadgeProps {
  children: ReactNode
  variant: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  blue: 'bg-blue/10 text-blue',
  purple: 'bg-purple-500/10 text-purple-500',
  green: 'bg-green/10 text-green',
  orange: 'bg-orange/10 text-orange',
}

export function Badge({ children, variant }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  )
}
