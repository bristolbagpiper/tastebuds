'use client'

import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cx } from '@/lib/app/format'

type BaseButtonProps = {
  className?: string
  children: ReactNode
  size?: 'default' | 'sm'
  variant?: 'primary' | 'secondary' | 'ghost'
}

type ButtonElementProps = BaseButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
    target?: undefined
  }

type LinkButtonProps = BaseButtonProps & {
  href: string
  target?: string
}

type ButtonProps = ButtonElementProps | LinkButtonProps

const VARIANT_STYLES = {
  ghost:
    'border border-transparent bg-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border-soft)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]',
  primary:
    'border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(199,106,74,0.18)] hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-strong)]',
  secondary:
    'border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-[color:var(--accent)] hover:bg-[color:var(--surface-strong)]',
} as const

const SIZE_STYLES = {
  default: 'rounded-2xl px-4 py-2.5 text-sm font-medium',
  sm: 'rounded-xl px-3 py-2 text-xs font-medium',
} as const

export function Button({
  children,
  className,
  size = 'default',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classNames = cx(
    'inline-flex items-center justify-center transition disabled:cursor-not-allowed disabled:border-[color:var(--border-soft)] disabled:bg-[color:color-mix(in_srgb,var(--surface)_82%,var(--background))] disabled:text-[color:var(--text-muted)]',
    SIZE_STYLES[size],
    VARIANT_STYLES[variant],
    className
  )

  if ('href' in props && props.href) {
    return (
      <Link className={classNames} href={props.href} target={props.target}>
        {children}
      </Link>
    )
  }

  const { type = 'button', ...buttonProps } = props as ButtonElementProps

  return (
    <button
      className={classNames}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  )
}
