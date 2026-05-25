import QRCode from 'qrcode';

export async function buildQrDataUrl(value: string, width = 420) {
  return QRCode.toDataURL(value, {
    width,
    margin: 1,
    color: {
      dark: '#111111',
      light: '#ffffff',
    },
  });
}
