"server-only";

import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { LLMTXTError } from "./errors";
import { validateAndSanitizeUrl } from "./security";

export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0 ) {
      throw error;
    }
    console.warn(`Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

export async function extractContent($: cheerio.CheerioAPI) {
  // Try Mozilla Readability first
  try {
    const doc = new JSDOM($.html());
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (article && article.textContent.length > 100) {
      return { title: article.title, content: article.textContent };
    }
  } catch {
    console.log("Readability extraction failed, using fallback method");
  }

  // Fallback to custom extraction if Readability fails
  const title = $('title').text() || $('h1').first().text() || 'Untitled Document';

  // Remove unwanted elements
  $('script, style, nav, footer, iframe, [role="banner"], [role="navigation"]').remove();

  const mainContent = $('main, article, #content, .content, .post, .article').first();
  const content = mainContent.length
    ? mainContent.text()
    : $('body').text();

  return { title, content };
}

export async function validateAndFetchContent(url: string): Promise<string> {
    const sanitizedUrl = validateAndSanitizeUrl(url);
    if (!sanitizedUrl.success) {
      throw new LLMTXTError("The provided URL is invalid. Please enter a valid URL.", "INVALID_URL");
    }

    const webpageResponse = await retry(() => fetch(url));

    if (!webpageResponse.ok) {
      throw new LLMTXTError(
        `Failed to fetch the webpage. Please check the URL and your internet connection.`,
        "FETCH_ERROR",
        webpageResponse.status
      );
    }

    return webpageResponse.text();
}

// export function extractAndFormatContent(html: string): { title: string; content: string; } {
//     const $ = cheerio.load(html);
//     const { title, content } = extractContent($);

//     if (!content) {
//       throw new LLMTXTError(
//         "Could not extract the main content from this webpage. It might be dynamically generated or require JavaScript to load.",
//         "PARSE_ERROR"
//       );
//     }
//   return {title, content}
// }
