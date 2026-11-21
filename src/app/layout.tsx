import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SM Tracking — Social Media Tracking & Scheduling", template: "%s · SM Tracking" },
  description: "Plan, schedule and publish to Facebook, Instagram, X, LinkedIn, TikTok, YouTube and more — with your whole team.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e13" },
  ],
};

// Runs before paint so there is no light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('pp-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;600&family=Noto+Sans+Bengali:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Thai:wght@400;600&family=Noto+Sans+Hebrew:wght@400;600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="min-h-dvh">
        {children}
      </body>
    </html>
  );
}
