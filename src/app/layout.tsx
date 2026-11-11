import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";
import { ConfirmDialogHost } from "@/components/ConfirmDialog";
import { Toaster } from "@/components/ui/sonner";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Träning",
  description: "Personlig träningslogg med coach",
  applicationName: "Träning",
  appleWebApp: { capable: true, title: "Träning", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorker />
        <ThemeWatcher />
        <ConfirmDialogHost />
        <Toaster />
      </body>
    </html>
  );
}
