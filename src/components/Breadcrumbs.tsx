import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';

/**
 * Breadcrumbs — small horizontal trail at the top of each detail
 * page showing where you are in the site hierarchy. Helps both UX
 * (one-click back to the parent state/section) and SEO (Google
 * uses BreadcrumbList JSON-LD to show the trail in search results
 * instead of a raw URL).
 *
 * Each crumb has a `label` and an optional `href`. A crumb without
 * `href` renders as plain text — useful for the current page (last
 * item) or intermediate categories that don't have their own page
 * yet (city, when only state pages exist).
 */

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  // BreadcrumbList JSON-LD — only items with hrefs become real
  // ListItems with `item`. Plain-text crumbs are still numbered but
  // don't get a clickable URL (Google ignores them, which is fine).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: c.href.startsWith('http') ? c.href : `${SITE_URL}${c.href}` } : {}),
    })),
  };
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--ink-soft)] ${className}`}
      >
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <span key={i} className="inline-flex items-center gap-1.5">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="rounded px-1 hover:text-[var(--tj-red)] hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'text-[var(--ink)]' : ''}>
                  {c.label}
                </span>
              )}
              {!last && <span className="opacity-50">›</span>}
            </span>
          );
        })}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
