import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Tipografías de la interfaz de Studio (identidad WayUp): servidas desde el propio sitio en el build.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: 'WayUp Studio',
  description: 'Crea, edita y publica webs profesionales con agentes de IA integrados.',
  icons: { icon: [{ url: '/brand/wayup-logo-cobalt-disc.svg', type: 'image/svg+xml' }] },
};
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#090a0e' },
  ],
};

// Se ejecuta antes de pintar: aplica el tema guardado o el del sistema, sin parpadeo.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('wayup-studio-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var d=document.documentElement;d.dataset.theme=t;d.dataset.studioTheme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable} ${jetbrains.variable}`}>
    <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
    <body className="antialiased">{children}</body>
  </html>;
}
