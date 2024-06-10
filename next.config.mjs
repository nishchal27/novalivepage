//for dev only
import withBundleAnalyzer from '@next/bundle-analyzer';

//for dev only
const bundleAnalyzer = withBundleAnalyzer({
	enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [
          'uploadthing.com',
          'utfs.io',
          'img.clerk.com',
          'subdomain',
          'files.stripe.com',
        ],
      },
      reactStrictMode: false,
};

//for development only
export default bundleAnalyzer(nextConfig);

// export default nextConfig; 