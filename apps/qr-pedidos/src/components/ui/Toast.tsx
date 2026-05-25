// src/components/ui/Toast.tsx
import { useToastStore } from '@/store/useToastStore'
import styles from './Toast.module.css'

export default function Toast() {
  const { message, visible } = useToastStore()
  return (
    <div className={`${styles.toast} ${visible ? styles.visible : ''}`}>
      {message}
    </div>
  )
}
