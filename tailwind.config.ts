import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Jacob & Co inspired palette
        ink:        '#0a0a0c',   // deep black, page background
        carbon:     '#15151a',   // panel background
        bone:       '#f5f2ea',   // off-white text
        // Variant accent tones — pulled from the watch's actual materials
        'rose-gold':   '#c98363',
        'white-gold':  '#dfe1e3',
        'yellow-gold': '#d4ad58',
        'jc-gold':     '#b4904e',  // the brand's signature warm gold
        sapphire:      '#3661a9',
        citrine:       '#d6a04e',
        crimson:       '#7b1e1e',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in':  'fade-in 1.2s ease-out forwards',
        'fade-up':  'fade-up 1s ease-out forwards',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      margin: {
        'screen': '100vh',
      },
    },
  },
  plugins: [],
};
export default config;
