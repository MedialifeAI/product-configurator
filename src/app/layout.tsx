import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Astronomia Dragon — Jacob & Co',
  description:
    'A hand-engraved 18K rose gold dragon orbits a triple-axis gravitational tourbillon, a lacquered terrestrial globe, and a faceted diamond. Explore every component in 3D.',
  openGraph: {
    title: 'Astronomia Dragon — Jacob & Co',
    description: 'Explore the Astronomia Dragon in 3D.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased vignette">{children}</body>
    </html>
  );
}
