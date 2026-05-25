// src/lib/utils.ts

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function getAllergenEmoji(allergen: string): string {
  const map: Record<string, string> = {
    gluten: '🌾', crustaceans: '🦀', eggs: '🥚', fish: '🐟',
    peanuts: '🥜', soybeans: '🫘', milk: '🥛', nuts: '🌰',
    celery: '🥬', mustard: '🌿', sesame: '🌿', sulphites: '🍷',
    lupin: '🌻', molluscs: '🦪',
  }
  return map[allergen] ?? '⚠️'
}
