import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Geist, Geist_Mono, Outfit, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";

const interHeading = Inter({ subsets: ['latin'], variable: '--font-heading' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | FarmInsight',
    default: 'FarmInsight — Farm Management System',
  },
  description: "FarmInsight — Farm Management System",
  openGraph: {
    title: "FarmInsight — Farm Management System",
    description: "FarmInsight — Farm Management System",
    siteName: "FarmInsight",
    images: [
      {
        url: "/preview.png",
        width: 2048,
        height: 2048,
        alt: "FarmInsight — Farm Management System",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", outfit.variable, interHeading.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
