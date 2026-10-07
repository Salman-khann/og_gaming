import type { Metadata } from 'next';
import { Inter, Rajdhani } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'OG Gaming | High-End Gaming Zone in Bahadurabad, Karachi — PC & PS5 Bays',
  description:
    "OG Gaming is Bahadurabad's high-end gaming zone: 240Hz MSI esports PC cabins, a PS5 Slim lounge with bean bags, chilled AC and Japanese Aqua gaming chairs. Book a PC or PS5 bay on WhatsApp — Suite 201, Meriums Complex, Main Bahadurabad, Karachi.",
  keywords: [
    'gaming zone Bahadurabad',
    'gaming lounge Karachi',
    'PS5 rental Karachi',
    'PC gaming cafe Karachi',
    'esports cafe Bahadurabad',
    'OG Gaming',
    'gaming cabins Karachi',
    'PS5 lounge Bahadurabad',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${rajdhani.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
