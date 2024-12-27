import { ThemeProvider } from "@/components/theme-provider";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata = {
  title: "Free llms.txt Generator",
  description: "Generate llms.txt files from webpages for AI agents free of cost",
  openGraph: {
    title: "Free llms.txt Generator",
    description: "Generate llms.txt files from webpages for AI agents free of cost",
    url: "https://freellmstxt.moinulmoin.com",
    siteName: "freellmstxt",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free llms.txt Generator",
    description: "Generate llms.txt files from webpages for AI agents free of cost",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>

        {process.env.NODE_ENV === "production" && (
          <Script src="https://umami.moinulmoin.com/script.js" data-website-id="0b2d6e5f-21c7-4cb3-a613-ffa3ba7fe27e"></Script>
        )}
      </body>
    </html>
  );
}
