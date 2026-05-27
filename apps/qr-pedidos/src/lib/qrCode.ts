import QRCode from 'qrcode'

export async function buildQrDataUrl(text: string, size: number): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  })
}
