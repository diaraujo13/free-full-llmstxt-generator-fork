import { ThemeProvider } from "@/components/theme-provider";
import { Geist, Geist_Mono } from "next/font/google";
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
      </body>
    </html>
  );
}
