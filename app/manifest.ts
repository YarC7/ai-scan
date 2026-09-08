import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Scan',
    short_name: 'AI Scan',
    description: 'Scan a boba tea order label',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#aa3bff',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
