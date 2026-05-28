'use client';

import type { SpecRow } from '@/lib/siteConfigTypes';

interface HeroSideFactsProps {
  rows: SpecRow[];
}

interface SideFact {
  headline: string;
  caption: string;
}

const LEFT_LABELS = ['Power reserve', 'Case'] as const;
const RIGHT_LABELS = ['Dragon', 'Limited edition'] as const;

function findRow(rows: SpecRow[], label: string): SpecRow | undefined {
  return rows.find(r => r.label.toLowerCase() === label.toLowerCase());
}

/** Pull a short gold headline + caption from specs rows (An exact accounting). */
function toSideFact(row: SpecRow | undefined): SideFact | null {
  if (!row) return null;

  switch (row.label) {
    case 'Power reserve': {
      const hours = row.value.match(/(\d+)/)?.[1];
      return hours
        ? { headline: hours, caption: 'hour power reserve' }
        : { headline: row.value, caption: row.label };
    }
    case 'Case': {
      const mm = row.value.match(/(\d+)\s*mm/i)?.[1];
      return mm
        ? { headline: `${mm} mm`, caption: 'rose gold case' }
        : { headline: row.value.split('·')[0]?.trim() ?? row.value, caption: 'case' };
    }
    case 'Dragon': {
      const scales = row.value.match(/([\d,]+)\s*scales/i)?.[1];
      return scales
        ? { headline: scales, caption: 'hand-engraved scales' }
        : { headline: '18K', caption: 'hand-engraved dragon' };
    }
    case 'Limited edition': {
      const pieces = row.value.match(/(\d+)/)?.[1];
      return pieces
        ? { headline: pieces, caption: 'pieces worldwide' }
        : { headline: row.value, caption: 'limited edition' };
    }
    default:
      return { headline: row.value.split(/[·—]/)[0]?.trim() ?? row.value, caption: row.label };
  }
}

function FactColumn({
  facts,
  align,
}: {
  facts: SideFact[];
  align: 'left' | 'right';
}) {
  if (facts.length === 0) return null;

  const textAlign = align === 'left' ? 'text-left items-start' : 'text-right items-end';
  const pos =
    align === 'left'
      ? 'left-[1.5vw] xl:left-[2vw] 2xl:left-[2.75vw]'
      : 'right-[1.5vw] xl:right-[2vw] 2xl:right-[2.75vw]';

  return (
    <div
      className={`absolute ${pos} top-[26%] bottom-[36%] hidden lg:flex flex-col justify-between ${textAlign}`}
      aria-hidden
    >
      {facts.map(fact => (
        <div key={fact.caption} className={`flex flex-col gap-1.5 ${textAlign}`}>
          <span className="font-display text-[1.65rem] xl:text-[1.85rem] leading-none gold-text">
            {fact.headline}
          </span>
          <span className="max-w-[9rem] xl:max-w-[10rem] text-[9px] xl:text-[10px] tracking-[0.24em] uppercase text-jc-gold/50 font-sans leading-snug">
            {fact.caption}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Desktop hero flanks — compact gold callouts sourced from specs rows. */
export default function HeroSideFacts({ rows }: HeroSideFactsProps) {
  const left = LEFT_LABELS.map(label => toSideFact(findRow(rows, label))).filter(
    (f): f is SideFact => f !== null,
  );
  const right = RIGHT_LABELS.map(label => toSideFact(findRow(rows, label))).filter(
    (f): f is SideFact => f !== null,
  );

  return (
    <>
      <FactColumn facts={left} align="left" />
      <FactColumn facts={right} align="right" />
    </>
  );
}
