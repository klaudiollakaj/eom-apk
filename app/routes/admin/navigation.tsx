import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listAllNavLinks,
  createNavLink,
  updateNavLink,
  deleteNavLink,
} from '~/server/fns/navigation'

export const Route = createFileRoute('/admin/navigation')({
  component: NavigationPage,
})

function NavigationPage() {
  const [links, setLinks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  async function fetchLinks() {
    const result = await listAllNavLinks()
    setLinks(result)
  }

  useEffect(() => { fetchLinks() }, [])

  const headerLinks = links.filter(
    (l) => l.position === 'header' || l.position === 'both',
  )
  const footerLinks = links.filter(
    (l) => l.position === 'footer' || l.position === 'both',
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Navigation Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {showForm && (
        <NavLinkForm
          onSaved={() => { setShowForm(false); fetchLinks() }}
        />
      )}

      <LinkSection title="Header Links" links={headerLinks} onUpdated={fetchLinks} />
      <LinkSection title="Footer Links" links={footerLinks} onUpdated={fetchLinks} />
    </div>
  )
}

function LinkSection({
  title,
  links,
  onUpdated,
}: {
  title: string
  links: any[]
  onUpdated: () => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{link.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{link.url}</span>
              {link.isExternal && (
                <span className="rounded bg-blue-100 dark:bg-blue-900 px-1 text-xs text-blue-700 dark:text-blue-300">
                  External
                </span>
              )}
              {link.isPublishable && (
                <span className="rounded bg-green-100 dark:bg-green-900 px-1 text-xs text-green-700 dark:text-green-300">
                  Publishable
                </span>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Order: {link.sortOrder}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await updateNavLink({
                    data: { id: link.id, isVisible: !link.isVisible },
                  })
                  onUpdated()
                }}
                className={`rounded px-2 py-1 text-xs ${
                  link.isVisible
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {link.isVisible ? 'Visible' : 'Hidden'}
              </button>
              {link.isDeletable && (
                <button
                  onClick={async () => {
                    if (confirm(`Delete "${link.label}"?`)) {
                      await deleteNavLink({ data: { id: link.id } })
                      onUpdated()
                    }
                  }}
                  className="rounded bg-red-100 dark:bg-red-900 px-2 py-1 text-xs text-red-700 dark:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavLinkForm({ onSaved }: { onSaved: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [position, setPosition] = useState('header')
  const [sortOrder, setSortOrder] = useState(10)
  const [isExternal, setIsExternal] = useState(false)
  const [isPublishable, setIsPublishable] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createNavLink({
      data: { label, url, position, sortOrder, isExternal, isPublishable },
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" required className="rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (e.g. /about)" required className="rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
        <select value={position} onChange={(e) => setPosition(e.target.value)} className="rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm">
          <option value="header">Header</option>
          <option value="footer">Footer</option>
          <option value="both">Both</option>
        </select>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort Order" className="rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)} /> External
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={isPublishable} onChange={(e) => setIsPublishable(e.target.checked)} /> Publishable
        </label>
      </div>
      <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Add Link</button>
    </form>
  )
}
