/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY?: string
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
