import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Privacy — TJ Mascots',
  description:
    "Plain-language privacy policy: what we collect on TJ Mascots, what we do with it, and how to request removal.",
};

export default function PrivacyPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header — matches About */}
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
            title="Back to the map"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)] transition hover:scale-105"
          >
            🛒
          </Link>
          <Link href="/" className="block">
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">
              TJ Mascots
            </h1>
            <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
              an unofficial map of every Trader Joe&apos;s store mascot
            </p>
          </Link>
        </div>
        <Link
          href="/"
          aria-label="Back to the map"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">← Back to the map</span>
          <span className="hidden max-sm:inline">← Map</span>
        </Link>
      </header>

      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company. &ldquo;Trader Joe&apos;s&rdquo; is a
        trademark of Trader Joe&apos;s Company.
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-3xl px-6 py-12 max-sm:px-4 sm:py-16">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              The boring but important page
            </p>
            <h2 className="font-display text-5xl font-black leading-none tracking-tight text-[var(--tj-red)] sm:text-6xl">
              PRIVACY
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mt-4 text-sm font-semibold text-[var(--ink-soft)]">
              Last updated: April 24, 2026
            </p>
          </div>

          <div className="space-y-7 text-[17px] leading-relaxed text-[var(--ink)]">
            <p className="rounded-2xl bg-[var(--cream-dark)] px-5 py-4 text-base font-semibold">
              Short version: we collect almost nothing. The only things we ever
              get from you are what you choose to type into the submit or report
              forms, plus a photo if you upload one. We don&apos;t sell anything,
              we don&apos;t track you around the web, and you can ask us to delete
              your stuff at any time.
            </p>

            <Section heading="What we collect">
              <p>
                There are exactly two ways data leaves your device and reaches us:
              </p>
              <ul className="ml-5 mt-2 list-disc space-y-1.5">
                <li>
                  <strong>The submit form.</strong> When you submit a mascot,
                  we save the store you picked, the animal type, the mascot name
                  (if you give one), any notes, and the photo you upload.
                </li>
                <li>
                  <strong>The report form.</strong> When you report a correction,
                  we save what you flagged as wrong, what you said the right
                  answer is, and (if you typed it) the corrected store.
                </li>
              </ul>
              <p className="mt-3">
                Both forms have an optional <strong>email</strong> field. You
                only need to fill it in if you want photo credit on the live
                site, or want us to follow up with a question. Leave it blank
                and your submission stays anonymous.
              </p>
            </Section>

            <Section heading="What we do with it">
              <ul className="ml-5 list-disc space-y-1.5">
                <li>
                  <strong>Review it.</strong> The site&apos;s human admin reads
                  every submission to make sure it&apos;s a real mascot at a
                  real store before adding it to the map.
                </li>
                <li>
                  <strong>Display approved photos and notes</strong> on the
                  public map.
                </li>
                <li>
                  <strong>Credit you</strong> if you provided an email and gave
                  permission — usually as &ldquo;First Name + Last Initial&rdquo;
                  (e.g. &ldquo;Jason D.&rdquo;).
                </li>
              </ul>
            </Section>

            <Section heading="What we do NOT do">
              <ul className="ml-5 list-disc space-y-1.5">
                <li>We don&apos;t sell your email or any other data.</li>
                <li>We don&apos;t share data with advertisers.</li>
                <li>We don&apos;t put trackers on you across other websites.</li>
                <li>
                  We don&apos;t require an account, password, or any login.
                </li>
                <li>
                  We don&apos;t collect your location unless you tap the
                  &ldquo;📍 Use nearest store&rdquo; button — and even then your
                  coordinates stay in your browser to find the closest TJ&apos;s.
                  We never see them.
                </li>
              </ul>
            </Section>

            <Section heading="Cookies and analytics">
              <p>
                The site does not use any tracking cookies. If we add basic
                analytics in the future, we&apos;ll use a privacy-friendly tool
                like Plausible or GoatCounter that doesn&apos;t use cookies and
                doesn&apos;t collect personal information. We&apos;ll update
                this page if that changes.
              </p>
            </Section>

            <Section heading="Where the data lives">
              <p>
                Submitted photos and form rows are stored in a managed Postgres
                database hosted in the U.S. The site itself is served as static
                files from a U.S.-based cloud hosting provider. Public mascot
                photos are served from a CDN. We don&apos;t use any
                infrastructure that processes data outside the U.S.
              </p>
            </Section>

            <Section heading="How long we keep it">
              <p>
                Approved submissions become part of the public map and stay until
                we (or you) ask for them to be removed. Rejected or pending
                submissions are kept in the moderation queue indefinitely so we
                have a paper trail, but they aren&apos;t public.
              </p>
            </Section>

            <Section heading="How to remove your stuff">
              <p>
                If you want a photo, email credit, note, or any other piece of
                your data taken down, send us a message via the{' '}
                <strong>Contact us</strong> section at the bottom of this page.
                Tell us what you&apos;d like removed (a description or a link to
                the mascot card is enough) and the human admin will take it down
                — usually the same day.
              </p>
            </Section>

            <Section heading="Kids">
              <p>
                The site isn&apos;t aimed at children under 13 and we don&apos;t
                knowingly collect anything from them. If a kid submitted by
                accident, send us a note via the Contact section below and
                we&apos;ll wipe the entry.
              </p>
            </Section>

            <Section heading="A note about Trader Joe's">
              <p>
                TJ Mascots is a fan project, not affiliated with, endorsed by, or
                connected to Trader Joe&apos;s Company in any way.
                &ldquo;Trader Joe&apos;s&rdquo; is a trademark of Trader
                Joe&apos;s Company. If you&apos;re from Trader Joe&apos;s and
                you&apos;d like us to take something down, please use the
                Contact section at the bottom of this page and we&apos;ll
                respond promptly.
              </p>
            </Section>

            <Section heading="Changes to this policy">
              <p>
                If we update what we collect or how we use it, we&apos;ll bump
                the &ldquo;last updated&rdquo; date at the top of this page and
                describe what changed.
              </p>
            </Section>

            <Section heading="Questions">
              <p>
                Anything unclear? Drop us a line via the Contact section just
                below.
              </p>
            </Section>
          </div>

          {/* Contact section — placeholder until David picks the contact mechanism. */}
          <div
            id="contact"
            className="mt-14 rounded-3xl bg-[var(--cream-dark)] px-6 py-8 sm:px-10 sm:py-10"
          >
            <h3 className="mb-2 font-display text-2xl font-extrabold uppercase tracking-[0.1em] text-[var(--tj-red)]">
              Contact us
            </h3>
            <p className="text-base font-semibold leading-relaxed text-[var(--ink)]">
              The contact form is coming online shortly. In the meantime, the
              fastest way to reach the human admin is via the{' '}
              <strong>Report incorrect info</strong> button on any mascot card —
              add your message in the &ldquo;Other / details&rdquo; field and
              we&apos;ll see it within minutes.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)]"
            >
              Open the map →
            </Link>
            <Link
              href="/about"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              About this project
            </Link>
          </div>

          <footer className="mt-20 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 font-display text-lg font-extrabold uppercase tracking-[0.1em] text-[var(--tj-red)]">
        {heading}
      </h3>
      <div className="text-[var(--ink)]">{children}</div>
    </section>
  );
}
