'use client';

import { motion } from 'framer-motion';

const SPECS = [
  ['Reference',         'AT112.40.DR.SD.A'],
  ['Movement',          'Jacob & Co. JCAM10 — manual winding'],
  ['Complication',      'Triple-axis gravitational tourbillon (60s / 5min / 20min)'],
  ['Power reserve',     '60 hours'],
  ['Case',              '18K rose gold · 47 mm × 25 mm'],
  ['Crystal',           'Six sapphire crystals (top, bottom, caseband, lugs)'],
  ['Dragon',            '18K rose gold, hand-engraved with 2,294 scales'],
  ['Globe',             'Magnesium-lacquered terrestrial globe · 1-minute rotation'],
  ['Water resistance',  '30 m'],
  ['Limited edition',   '18 pieces'],
];

export default function SpecsAndCTA() {
  return (
    <>
      {/* Specs */}
      <section id="specs" className="relative w-full bg-ink py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">Specifications</span>
            <h2 className="font-display text-5xl md:text-6xl mt-3 text-bone">An exact accounting.</h2>
          </div>
          <div className="glass rounded-3xl divide-y divide-bone/5">
            {SPECS.map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: i * 0.04, duration: 0.5 }}
                className="grid grid-cols-[1fr_2fr] gap-6 px-6 md:px-10 py-5"
              >
                <dt className="text-xs uppercase tracking-[0.2em] text-bone/50 font-sans">{k}</dt>
                <dd className="text-bone/90 font-light">{v}</dd>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="inquire" className="relative w-full bg-ink py-32 px-6 md:px-12 overflow-hidden">
        {/* Faint gold radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(180,144,78,0.15) 0%, transparent 60%)' }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="text-xs tracking-[0.3em] uppercase text-jc-gold/80">By Appointment</span>
          <h2 className="font-display text-5xl md:text-7xl mt-3 text-bone">
            Begin a conversation.
          </h2>
          <p className="text-bone/60 mt-6 max-w-xl mx-auto font-light leading-relaxed">
            Only eighteen pieces will exist. Each is finished to the wearer&apos;s specification by our master engravers in
            Geneva. Reach out to schedule a private viewing at the boutique nearest you.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center">
            <a
              href="mailto:concierge@jacobandco.com?subject=Astronomia%20Dragon%20Inquiry"
              className="px-8 py-4 rounded-full bg-jc-gold text-ink text-sm tracking-[0.25em] uppercase hover:bg-yellow-gold transition"
            >
              Request a viewing
            </a>
            <a
              href="https://jacobandco.com/boutiques"
              className="px-8 py-4 rounded-full border border-jc-gold/40 text-bone text-sm tracking-[0.25em] uppercase hover:bg-jc-gold/10 transition"
            >
              Find a boutique
            </a>
          </div>
          <p className="mt-12 text-xs tracking-[0.25em] uppercase text-bone/30">
            Geneva · Monaco · New York · Dubai · Hong Kong · Tokyo
          </p>
        </div>
      </section>

      <footer className="bg-ink border-t border-bone/10 py-8 text-center text-xs text-bone/40">
        © {new Date().getFullYear()} Jacob &amp; Co. · Astronomia Dragon · This page is an interactive presentation.
      </footer>
    </>
  );
}
