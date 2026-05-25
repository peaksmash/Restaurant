export async function buildQrDataUrl(text: string, size: number): Promise<string> {
  const QRCode = await import('qrcode')
  return QRCode.default.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  })
}
