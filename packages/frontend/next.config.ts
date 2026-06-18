import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: ['http2.mlstatic.com', 'mlstatic.com'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  }
}

export default nextConfig
