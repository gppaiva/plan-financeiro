import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

interface PageContainerProps {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <main className="mx-auto w-full max-w-[390px] flex-1 pb-20 sm:max-w-[640px] lg:max-w-[960px]">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
