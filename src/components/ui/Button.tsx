import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg',
  secondary: 'bg-bg2 text-text',
  danger: 'bg-red/10 text-red',
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 font-medium transition-opacity ${variantStyles[variant]} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-90 active:opacity-80'} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
