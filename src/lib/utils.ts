import { CheerioAPI } from 'cheerio';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractContent($: CheerioAPI) {
  // Remove noisy elements
  $('script, style, nav, footer, header, iframe, [role="banner"], [role="navigation"], .ads, #ads, .advertisement, aside').remove();

  const title = $('title').text() ||
  $('meta[property="og:title"]').attr('content') ||
  $('meta[name="twitter:title"]').attr('content') ||
  $('h1').first().text() ||
  'Untitled';

  // Find main content with prioritized selectors
  const mainSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#content',
    '.article-body'
  ];

  let mainContent = '';
  for (const selector of mainSelectors) {
    const element = $(selector);
    if (element.length) {
      mainContent = element.text();
      break;
    }
  }

  // Fallback to body if no main content found
  if (!mainContent) {
    mainContent = $('body').text();
  }

  // Basic cleaning only
  return {
    title,
    content: mainContent.trim().replace(/\s+/g, ' ')
  };
}

export const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
