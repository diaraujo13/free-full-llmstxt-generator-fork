"use server";

import { ErrorCode, handleError, LLMTXTError } from "@/lib/errors";
import { ratelimit } from "@/lib/rate-limit";
import { validateAndSanitizeUrl } from "@/lib/security";
import { extractContent, retry } from "@/lib/utils-server";
import * as cheerio from "cheerio";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";

export type FullGenerateResponse = {
  urls: { url: string; title: string }[];
  content?: string;
  error?: string;
  code?: ErrorCode;
};

// Step 1: Given a URL, fetch and extract all relevant links (internal, same domain)
export async function extractUrlsAction(
  prevState: unknown,
  formData: FormData
): Promise<FullGenerateResponse> {
  const url = formData.get("url")?.toString() || "";
  try {
    const headersList = await headers();
    const identifier =
      headersList.get("cf-connecting-ip") ??
      headersList.get("x-real-ip") ??
      headersList.get("x-forwarded-for") ??
      "127.0.0.1";
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      throw new LLMTXTError(
        "Your daily limit has been reached. Please try again tomorrow.",
        "RATE_LIMIT_EXCEEDED"
      );
    }
    const sanitizedUrl = validateAndSanitizeUrl(url);
    if (!sanitizedUrl.success) {
      return {
        urls: [],
        error: "The provided URL is invalid. Please enter a valid URL.",
        code: "INVALID_URL",
      };
    }
    const webpageResponse = await retry(() => fetch(url));
    if (!webpageResponse.ok) {
      throw new LLMTXTError(
        `Failed to fetch the webpage. Please check the URL and your internet connection.`,
        "FETCH_ERROR",
        webpageResponse.status
      );
    }
    const html = await webpageResponse.text();
    const $ = cheerio.load(html);
    // Extract all internal links (same domain)
    const baseUrl = new URL(url);
    const links: { url: string; title: string }[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const absUrl = new URL(href, baseUrl).toString();
        if (absUrl.startsWith(baseUrl.origin)) {
          const title = $(el).text().trim() || absUrl;
          if (!links.some(l => l.url === absUrl)) {
            links.push({ url: absUrl, title });
          }
        }
      } catch {}
    });
    // Also include the main page itself
    links.unshift({ url, title: $("title").text() || url });
    return { urls: links };
  } catch (error) {
    const handledError = handleError(error);
    return {
      urls: [],
      error: handledError.message,
      code: handledError.code,
    };
  }
}

// Step 2: Given a list of URLs, fetch/extract/concatenate content and return markdown
export async function generateLlmsFullTxtAction(
  prevState: unknown,
  formData: FormData
): Promise<FullGenerateResponse & { downloadUrl?: string }> {
  const urls = formData.getAll("urls") as string[];
  try {
    let h1 = "";
    let summary = "";
    let fileLists: string[] = [];
    const total = urls.length;
    let current = 0;
    const startTime = Date.now();
    console.log(`[LLMS] Starting full content generation for ${total} URLs.`);

    // Ensure export directory exists
    const exportDir = path.join(process.cwd(), "public", "export");
    await fs.mkdir(exportDir, { recursive: true });
    // Use a unique filename per job
    const uniqueId = Date.now();
    const fileName = `llms-full-${uniqueId}.txt`;
    const filePath = path.join(exportDir, fileName);
    const downloadUrl = `/export/${fileName}`;

    for (const url of urls) {
      current++;
      const linkStart = Date.now();
      console.log(`[LLMS] [${current}/${total}] Fetching: ${url}`);
      try {
        const webpageResponse = await retry(() => fetch(url));
        if (!webpageResponse.ok) {
          console.warn(`[LLMS] [${current}/${total}] Failed to fetch: ${url} (status: ${webpageResponse.status})`);
          continue;
        }
        const html = await webpageResponse.text();
        const $ = cheerio.load(html);
        const { title, content } = await extractContent($);
        if (!h1) h1 = `# ${title}\n`;
        if (!summary) summary = `> ${content.split(". ")[0]}\n`;
        fileLists.push(`- [${title}](${url})`);
        // Append content to file incrementally
        const toAppend = `\n\n# ${title}\n\n${content}\n`;
        await fs.appendFile(filePath, toAppend, "utf8");
        const linkElapsed = ((Date.now() - linkStart) / 1000).toFixed(2);
        console.log(`[LLMS] [${current}/${total}] Success: ${url} (Elapsed: ${linkElapsed}s)`);
      } catch (err) {
        const linkElapsed = ((Date.now() - linkStart) / 1000).toFixed(2);
        console.warn(`[LLMS] [${current}/${total}] Extraction failed: ${url} (Elapsed: ${linkElapsed}s)`, err);
      }
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[LLMS] Progress: ${current}/${total} links processed. Total elapsed: ${elapsed}s`);
    }
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[LLMS] Finished full content generation. Processed ${current}/${total} links in ${totalElapsed}s.`);
    // Append file list and summary at the end
    const fileListSection = `\n\n## File List\n${fileLists.join("\n")}`;
    await fs.appendFile(filePath, fileListSection, "utf8");
    return { urls: [], content: undefined, downloadUrl };
  } catch (error) {
    const handledError = handleError(error);
    return {
      urls: [],
      error: handledError.message,
      code: handledError.code,
    };
  }
} 