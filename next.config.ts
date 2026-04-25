const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    localPatterns: [
      {
        pathname: "/qr-pago-admin.png",
      },
    ],
  },
};

export default nextConfig;
