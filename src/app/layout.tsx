import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "TJ Mascots — the unofficial map of every Trader Joe's plush",
  description:
    "An unofficial fan map of every Trader Joe's hidden plush mascot across the U.S. Click any pin to meet the mascot — or submit the one at your local store.",
  openGraph: {
    title: "TJ Mascots",
    description: "The unofficial map of every Trader Joe's plush mascot.",
    siteName: 'TJ Mascots',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;800;900&family=Nunito:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
