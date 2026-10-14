import type { ReactNode } from 'react'

export function LeatherBackground({ children }: { children: ReactNode }) {
  return <div className="leather-background"><div className="leather-grain" aria-hidden="true" />{children}</div>
}
