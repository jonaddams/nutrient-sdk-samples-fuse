import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutrient SDK Samples",
  description:
    "Interactive examples and demos showcasing Nutrient SDKs and features.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* DNS prefetch hints for faster CDN connections */}
        <link rel="dns-prefetch" href="//cdn.cloud.pspdfkit.com" />
        <link
          rel="preconnect"
          href="https://cdn.cloud.pspdfkit.com"
          crossOrigin="anonymous"
        />

        {/* Nutrient Web SDK */}
        <script
          src={`https://cdn.cloud.pspdfkit.com/pspdfkit-web@${process.env.NEXT_PUBLIC_WEB_SDK_VERSION || "1.10.0"}/nutrient-viewer.js`}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
