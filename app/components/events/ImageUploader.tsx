import { useState, useRef } from 'react'
import { generateReactHelpers } from '@uploadthing/react'
import type { UploadRouter } from '~/server/uploadthing'

const { useUploadThing } = generateReactHelpers<UploadRouter>()

interface ImageUploaderProps {
  value: string | null
  onChange: (url: string | null) => void
  purpose: 'banner' | 'gallery'
  label?: string
}

export function ImageUploader({ value, onChange, purpose, label }: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null)

  const endpoint = purpose === 'banner' ? 'bannerImage' : 'galleryImage'

  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        onChange(res[0].ufsUrl)
      }
    },
    onUploadError: () => {
      setError('Upload failed. Please try again.')
    },
  })

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setError(null)
    startUpload([file])
  }

  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
      {value ? (
        <div className="relative">
          <img src={value} alt="Preview" className="h-48 w-full rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-500 dark:border-gray-600 dark:hover:border-indigo-400"
        >
          {isUploading ? (
            <p className="text-sm text-gray-500">Uploading...</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">Drag & drop or click to upload</p>
              <p className="mt-1 text-xs text-gray-400">PNG, JPG up to 10MB</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
