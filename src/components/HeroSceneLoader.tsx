'use client';

interface HeroSceneLoaderProps {
  progress: number;
  label?: string;
  sublabel?: string;
}

export default function HeroSceneLoader({
  progress,
  label = 'Preparing 3D experience',
  sublabel = 'Loading the dragon…',
}: HeroSceneLoaderProps) {
  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink z-[2]">
      <div className="text-center w-full max-w-xs px-8">
        <div className="inline-block w-12 h-12 border-2 border-jc-gold/30 border-t-jc-gold rounded-full animate-spin" />
        <div className="mt-6 text-xs tracking-[0.3em] uppercase text-bone/60">{label}</div>
        <div className="mt-2 text-[10px] tracking-[0.2em] uppercase text-bone/40">{sublabel}</div>
        <div className="mt-5 h-1 rounded-full bg-bone/10 overflow-hidden">
          <div
            className="h-full bg-jc-gold/80 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] text-bone/45 tabular-nums">{pct > 0 ? `${pct}%` : '—'}</div>
      </div>
    </div>
  );
}
