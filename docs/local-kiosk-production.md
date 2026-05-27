# Kiosko local en produccion

## Objetivo

Arrancar el kiosko en el PC del local sin desplegar nada online:

- backend local en `3001`
- kiosko web en `3000`
- Chrome en modo kiosko a pantalla completa
- autoarranque al encender Windows

## Scripts listos

Carpeta:

- [tools/local-kiosk/start-kiosk-stack.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\start-kiosk-stack.cmd)
- [tools/local-kiosk/open-kiosk-chrome.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\open-kiosk-chrome.cmd)
- [tools/local-kiosk/stop-kiosk-stack.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\stop-kiosk-stack.cmd)
- [tools/local-kiosk/install-kiosk-autostart.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\install-kiosk-autostart.cmd)

## Requisitos en el PC del local

- Windows
- Node.js instalado
- Chrome instalado
- proyecto copiado completo
- `npm install` ejecutado al menos una vez

## Arranque manual

Haz doble clic en:

- [start-kiosk-stack.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\start-kiosk-stack.cmd)

Eso hace:

1. arranca `local-server`
2. arranca `kiosk-web`
3. espera a que abran `3001` y `3000`
4. abre Chrome en modo kiosko

## Parar el entorno

Haz doble clic en:

- [stop-kiosk-stack.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\stop-kiosk-stack.cmd)

## Autoarranque al encender

Haz doble clic en:

- [install-kiosk-autostart.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\install-kiosk-autostart.cmd)

Eso copia el lanzador al inicio de Windows del usuario actual.

## Bloqueo del kiosko

Chrome en modo kiosko ayuda, pero **no bloquea Windows al 100%**.

Lo recomendable para un kiosko real es:

1. crear un usuario local solo para kiosko
2. quitar permisos de administrador a ese usuario
3. configurar inicio automático de sesión de ese usuario
4. usar el script de autoarranque
5. ocultar barra de tareas si quieres un entorno más limpio

## Bloqueo fuerte de verdad

Si quieres que el cliente no pueda salir prácticamente nunca:

- usa una cuenta estándar de Windows dedicada
- desactiva accesos innecesarios
- considera modo kiosko de Windows / acceso asignado si tu edición de Windows lo permite

### Importante

Ningún script de Chrome puede bloquear por completo:

- `Ctrl + Alt + Supr`
- políticas del sistema
- salida forzada del sistema operativo

Para eso hace falta bloqueo a nivel Windows, no solo navegador.

## URLs locales esperadas

- kiosko: [http://localhost:3000](http://localhost:3000)
- backend: [http://localhost:3001/api/config](http://localhost:3001/api/config)

## Checklist antes de abrir al público

1. arranca [start-kiosk-stack.cmd](C:\Users\smashme\Documents\New%20project%203\tools\local-kiosk\start-kiosk-stack.cmd)
2. comprueba que abre Chrome a pantalla completa
3. comprueba que carga el catálogo
4. prueba un pago con tarjeta
5. prueba un pago con CashDro
6. prueba cancelación de tarjeta
7. prueba cancelación y timeout de CashDro
8. comprueba que los pedidos llegan a Last

## Nota importante sobre multi-PC

Estos scripts están pensados para **un solo PC** con backend y kiosko en la misma máquina.

Si el backend va en otro PC del local:

- cambia la URL del kiosko para apuntar a la IP del servidor
- no uses `localhost`

En ese caso conviene preparar un `.env.local` específico para `apps/kiosk-web`.
