import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'

export interface ScannerCameraProps {
  onScan: (text: string) => void
  paused?: boolean
}

export function ScannerCamera({ onScan, paused = false }: ScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (paused) return
    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (cancelled || !videoRef.current) return
        const deviceId =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          devices[0]?.deviceId
        if (!deviceId) {
          setError('No camera found')
          return
        }
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              onScanRef.current(result.getText())
            }
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      } catch (e: any) {
        setError(e?.message || 'Could not start camera')
      }
    }

    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [paused])

  return (
    <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-white/70" />
    </div>
  )
}
