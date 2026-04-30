import * as React from 'react'

import { cx } from '@/lib/app/format'

type LogoSize = 'sm' | 'md' | 'lg'

const sizes = {
  sm: {
    gap: 'gap-2',
    mark: 42,
    text: 'text-2xl',
  },
  md: {
    gap: 'gap-3',
    mark: 46,
    text: 'text-3xl',
  },
  lg: {
    gap: 'gap-4',
    mark: 68,
    text: 'text-5xl',
  },
} satisfies Record<LogoSize, { gap: string; mark: number; text: string }>

type TastebudsMarkProps = {
  className?: string
  size?: LogoSize | number
}

function resolveMarkSize(size: LogoSize | number | undefined) {
  if (typeof size === 'number') {
    return size
  }

  return sizes[size ?? 'md'].mark
}

export function TastebudsMark({
  className,
  size = 'md',
}: TastebudsMarkProps) {
  const resolvedSize = resolveMarkSize(size)

  return (
    <svg
      aria-label="Tastebuds mark"
      className={className}
      fill="none"
      height={resolvedSize}
      role="img"
      viewBox="0 0 100 100"
      width={resolvedSize}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="
          M50 7
          C25.7 7 6 26.7 6 51
          C6 75.3 25.7 95 50 95
          C72.1 95 90.4 78.7 93.5 57.4
          C87.3 58.3 81.6 54.1 80.5 47.9
          C74.5 49.4 68.5 45.6 67.3 39.4
          C61.3 40.6 55.5 36.6 54.6 30.5
          C53.8 24.7 57.2 19.2 62.5 17.1
          C58.5 10.9 54.5 7 50 7Z
        "
        fill="#F59E0B"
      />
      <path
        d="M29 39C34 34.5 40 34.5 44.5 39"
        stroke="#FAF8F4"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <circle cx="61.5" cy="41" fill="#FAF8F4" r="5.2" />
      <path
        d="M27 61C39 75 61 76 74 61"
        stroke="#FAF8F4"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path
        d="
          M58 71
          C58 82 63 87 69 84
          C74 81.5 74 73.5 68 69
        "
        fill="#FAF8F4"
      />
      <path
        d="M64 74C64.5 78 63.5 81 61.5 83"
        stroke="#F59E0B"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  )
}

type TastebudsLogoProps = {
  className?: string
  showWordmark?: boolean
  size?: LogoSize
}

export function TastebudsLogo({
  className,
  showWordmark = true,
  size = 'md',
}: TastebudsLogoProps) {
  const config = sizes[size]

  return (
    <div
      aria-label="Tastebuds"
      className={cx('inline-flex items-center', config.gap, className)}
    >
      <TastebudsMark size={config.mark} />
      {showWordmark ? (
        <span
          className={cx(
            'leading-none font-extrabold tracking-[-0.04em] text-[#0F172A]',
            config.text
          )}
        >
          Tastebuds
        </span>
      ) : null}
    </div>
  )
}
