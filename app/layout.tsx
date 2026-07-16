import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Earthcare Landscapes",
  description: "Landscaping project management for Earthcare Landscapes",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/earthcare-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — reads localStorage before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}<SpeedInsights /><Analytics /></body>
    </html>
  );
}
