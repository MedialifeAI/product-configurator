'use client';

/**
 * ActivatedPrintSection — editorial split layout at the bottom of the page.
 *
 * Pairs a poster image (left/top) with eyebrow + title + body + optional CTA.
 * Mirrors the dark + gold aesthetic of the rest of the site, with a subtle
 * gold gradient scrim behind the image to lift it off the page.
 *
 * All copy + image source come from `config.content.activatedPrint`. When
 * `enabled === false` (admin toggle), the whole section renders nothing.
 */

import { motion } from 'framer-motion';
import { useSiteConfig } from '@/context/SiteConfigProvider';

export default function ActivatedPrintSection() {
  const { config } = useSiteConfig();
  const print = config.content.activatedPrint;

  if (!print || !print.enabled) return null;

  const hasCta = Boolean(print.ctaLabel && print.ctaHref);

  return (
    <section
      id="activated-print"
      className="relative w-full bg-ink py-24 md:py-32 px-6 md:px-12 overflow-hidden"
    >
      {/* Soft gold radial — frames the artwork without dominating it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 70% at 30% 40%, rgba(180,144,78,0.10) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto grid gap-10 md:gap-14 md:grid-cols-[1.05fr_1fr] items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative"
        >
          {/* Gold hairline frame */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-jc-gold/40 via-jc-gold/10 to-transparent" />
          <div className="relative rounded-2xl overflow-hidden bg-carbon">
            {print.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={print.imageUrl}
                alt={print.imageAlt || print.title}
                className="block w-full h-auto select-none"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="aspect-[3/4] flex items-center justify-center text-center px-6 text-bone/40 text-xs tracking-[0.25em] uppercase">
                Set image URL in admin
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.08 }}
          className="md:pl-2"
        >
          {print.eyebrow && (
            <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">
              {print.eyebrow}
            </span>
          )}
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl mt-3 text-bone leading-[1.05]">
            {print.title}
          </h2>
          {/* Gold separator */}
          <div className="mt-6 h-px w-16 bg-gradient-to-r from-jc-gold/70 to-jc-gold/10" />
          {print.body && (
            <p className="mt-6 text-bone/65 font-light leading-relaxed max-w-md">
              {print.body}
            </p>
          )}
          {hasCta && (
            <div className="mt-8">
              <a
                href={print.ctaHref}
                target={print.ctaHref?.startsWith('http') ? '_blank' : undefined}
                rel={print.ctaHref?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-jc-gold/45 text-bone text-[11px] tracking-[0.28em] uppercase hover:bg-jc-gold/10 hover:border-jc-gold/70 transition"
              >
                {print.ctaLabel}
                <span aria-hidden className="text-jc-gold/80">↗</span>
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
