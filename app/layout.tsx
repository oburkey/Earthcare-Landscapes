import type { Metadata } from "next";
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
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
