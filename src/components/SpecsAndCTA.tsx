'use client';

import { motion } from 'framer-motion';
import ActivatedPrintSection from '@/components/ActivatedPrintSection';
import { useSiteConfig } from '@/context/SiteConfigProvider';
import { scrollToConfigurator } from '@/lib/ar';

export default function SpecsAndCTA() {
  const { config } = useSiteConfig();
  const { specs, cta, footer } = config.content;

  return (
    <>
      <section id="specs" className="relative w-full bg-ink py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">{specs.eyebrow}</span>
            <h2 className="font-display text-5xl md:text-6xl mt-3 text-bone">{specs.title}</h2>
            <button
              type="button"
              onClick={() => scrollToConfigurator()}
              className="mt-5 text-[10px] tracking-[0.28em] uppercase text-bone/45 hover:text-jc-gold transition"
            >
              Back to configurator ↑
            </button>
          </div>
          <div className="glass rounded-3xl divide-y divide-bone/5">
            {specs.rows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: i * 0.04, duration: 0.5 }}
                className="grid grid-cols-[1fr_2fr] gap-6 px-6 md:px-10 py-5"
              >
                <dt className="text-xs uppercase tracking-[0.2em] text-bone/50 font-sans">{row.label}</dt>
                <dd className="text-bone/90 font-light">{row.value}</dd>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="inquire" className="relative w-full bg-ink py-32 px-6 md:px-12 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(180,144,78,0.15) 0%, transparent 60%)' }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">{cta.eyebrow}</span>
          <h2 className="font-display text-5xl md:text-7xl mt-3 text-bone">{cta.title}</h2>
          <p className="text-bone/60 mt-6 max-w-xl mx-auto font-light leading-relaxed">{cta.body}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center">
            <a
              href={cta.primaryHref}
              className="px-8 py-4 rounded-full bg-jc-gold text-ink text-sm tracking-[0.25em] uppercase hover:bg-yellow-gold transition"
            >
              {cta.primaryLabel}
            </a>
            <a
              href={cta.secondaryHref}
              className="px-8 py-4 rounded-full border border-jc-gold/40 text-bone text-sm tracking-[0.25em] uppercase hover:bg-jc-gold/10 transition"
            >
              {cta.secondaryLabel}
            </a>
          </div>
          <p className="mt-12 text-xs tracking-[0.25em] uppercase text-bone/30">{cta.footerLine}</p>
        </div>
      </section>

      <ActivatedPrintSection />

      <footer className="bg-ink border-t border-bone/10 py-8 text-center text-xs text-bone/40">
        © {new Date().getFullYear()} {footer}
      </footer>
    </>
  );
}
