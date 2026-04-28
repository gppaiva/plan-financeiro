import type { ReactNode } from 'react'
import { TabBar } from './TabBar'

interface PageContainerProps {
  children: ReactNode
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
      }}
    >
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          margin: '0 auto',
          paddingBottom: 80,
        }}
      >
        {children}
      </main>
      <TabBar />
    </div>
  )
}
