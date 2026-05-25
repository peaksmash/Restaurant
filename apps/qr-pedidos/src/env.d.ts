/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
