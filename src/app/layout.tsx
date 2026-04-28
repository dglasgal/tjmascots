import type { Metadata } from 'next';
import './globals.css';
import Analytics from '@/components/Analytics';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: "TJ Mascots — the unofficial map of every Trader Joe's store mascot",
  description:
    "An unofficial fan map of every Trader Joe's hidden store mascot across the U.S. Click any pin to meet the mascot — or submit the one at your local store.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "TJ Mascots",
    description: "The unofficial map of every Trader Joe's store mascot.",
    siteName: 'TJ Mascots',
    type: 'website',
    url: SITE_URL,
  },
};

/**
 * Site-wide structured data — emitted in <head> on every page.
 *
 * - WebSite: tells Google "this is the canonical site at this URL,
 *   call it 'TJ Mascots'." Eligible for the brand sitelinks search
 *   box that appears for known sites in Google search results.
 * - Organization: identifies the project entity behind the site.
 *   We deliberately omit `sameAs` (no social profiles yet) and any
 *   contact info; both fields are optional.
 */
const siteJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TJ Mascots',
    alternateName: "TJ Mascots — Trader Joe's mascot map",
    url: SITE_URL,
    description:
      "An unofficial fan map of every Trader Joe's hidden store mascot across the U.S.",
    inLanguage: 'en-US',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TJ Mascots',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description:
      "Volunteer-run fan project mapping every Trader Joe's store mascot. Not affiliated with Trader Joe's Company.",
  },
];

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
        {/* Site-wide structured data — see siteJsonLd above */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
