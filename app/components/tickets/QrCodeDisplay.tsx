import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export interface QrCodeDisplayProps {
  value: string
  size?: number
}

export function QrCodeDisplay({ value, size = 256 }: QrCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).catch(() => {})
  }, [value, size])

  return (
    <div className="inline-block rounded-lg bg-white p-3">
      <canvas ref={canvasRef} />
    </div>
  )
}
