import { ImageUploader } from './ImageUploader'

export interface GalleryImage {
  imageUrl: string
  caption: string
  sortOrder: number
}

interface GalleryUploaderProps {
  images: GalleryImage[]
  onChange: (images: GalleryImage[]) => void
}

export function GalleryUploader({ images, onChange }: GalleryUploaderProps) {
  function addImage() {
    onChange([...images, { imageUrl: '', caption: '', sortOrder: images.length }])
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index).map((img, i) => ({ ...img, sortOrder: i })))
  }

  function updateImage(index: number, url: string | null) {
    if (!url) {
      removeImage(index)
      return
    }
    const updated = [...images]
    updated[index] = { ...updated[index], imageUrl: url }
    onChange(updated)
  }

  function updateCaption(index: number, caption: string) {
    const updated = [...images]
    updated[index] = { ...updated[index], caption }
    onChange(updated)
  }

  function moveUp(index: number) {
    if (index === 0) return
    const updated = [...images]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    onChange(updated.map((img, i) => ({ ...img, sortOrder: i })))
  }

  function moveDown(index: number) {
    if (index === images.length - 1) return
    const updated = [...images]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    onChange(updated.map((img, i) => ({ ...img, sortOrder: i })))
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Gallery Images</label>
      {images.map((img, index) => (
        <div key={index} className="rounded-lg border p-3 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <ImageUploader
                value={img.imageUrl || null}
                onChange={(url) => updateImage(index, url)}
                purpose="gallery"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => moveUp(index)} disabled={index === 0} className="rounded bg-gray-100 px-2 py-1 text-xs disabled:opacity-30 dark:bg-gray-700">Up</button>
              <button type="button" onClick={() => moveDown(index)} disabled={index === images.length - 1} className="rounded bg-gray-100 px-2 py-1 text-xs disabled:opacity-30 dark:bg-gray-700">Down</button>
              <button type="button" onClick={() => removeImage(index)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900 dark:text-red-400">Del</button>
            </div>
          </div>
          <input
            type="text"
            value={img.caption}
            onChange={(e) => updateCaption(index, e.target.value)}
            placeholder="Caption (optional)"
            className="mt-2 w-full rounded border px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addImage}
        className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-indigo-500 hover:text-indigo-500 dark:border-gray-600"
      >
        + Add Image
      </button>
    </div>
  )
}
