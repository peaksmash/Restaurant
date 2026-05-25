// src/components/layout/AppShell.tsx
import styles from './AppShell.module.css'

interface Props {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <div className={styles.shell}>
      {children}
    </div>
  )
}
