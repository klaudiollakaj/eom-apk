import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { ThemeProvider } from '~/lib/theme'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'EOM APK' },
    ],
    links: [
      { rel: 'stylesheet', href: '/app/styles.css' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-600">404</h1>
        <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">Page not found</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700">
          Go Home
        </a>
      </div>
    </div>
  )
}

function RootError({ error }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 dark:text-red-400">Something went wrong</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{error.message}</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700">
          Go Home
        </a>
      </div>
    </div>
  )
}

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased dark:bg-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
