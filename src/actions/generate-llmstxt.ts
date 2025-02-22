"use server";

import { ErrorCode, handleError, LLMTXTError } from "@/lib/errors";
import { ratelimit } from "@/lib/rate-limit";
import { validateAndSanitizeUrl } from "@/lib/security";
import { extractContent, retry } from "@/lib/utils-server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as cheerio from "cheerio";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const prompt = (
  content: string
) => `You are an expert webpage content formatter for creating high-quality Markdown suitable for training or providing context to large language models (LLMs). Your task is to convert input webpage content into clean, well-structured Markdown, paying meticulous attention to preserving semantic meaning and important formatting cues using Markdown syntax. Specifically:

* Maintain code blocks exactly as they appear in the source, using Markdown fenced code blocks (\`\`\`). Clearly identify the language if specified after the opening \`\`\`. Specifically:
    * Use fenced code blocks for both <pre> and <code> tags.
    * If a language is specified (e.g., in a class name like "language-javascript"), include it after the opening backticks.

* Structure the content logically using Markdown headings (#, ##, ###, etc), Markdown lists (*, -, or + for unordered; 1., 2. for ordered), and Markdown blockquotes (>). Specifically, use:
    * # for <h1> headings (typically the main title of the page).
    * ## for <h2> headings (major sections).
    * ### for <h3> headings (subsections).
    * #### for <h4> headings, and so on.
    * If heading levels go deeper than <h6>, consider using a combination of headings and bold text to represent the hierarchy.
*   For lists:
    * Use *, -, or + for unordered lists (<ul>).
    * Use 1., 2., etc. for ordered lists (<ol>).
    * For nested lists, indent the nested list items by four spaces for each level of nesting.

* Preserve emphasis (important information or distinct elements) using Markdown bold (**text** or __text__) and italics (*text* or _text_) syntax.

* Convert HTML <blockquote> elements to Markdown blockquotes. Use the > character at the beginning of each line within the blockquote.

* Convert HTML links into Markdown links ([link text](href_url)). eg: <a href="https://example.com">link text</a> -> [link text](https://example.com) or <a href="/about">link text</a> -> [link text](/about). No need to add placeholder for relative URLs

* Convert HTML <table> elements to Markdown tables. Strive for readability and accuracy. Use a header row, a separator row with hyphens, and then the table rows.

* Ensure clear separation between paragraphs (using blank lines) and sections for optimal readability by AI agents.

* Favor semantic Markdown structure over replicating visual presentation. Use appropriate Markdown elements to convey meaning. Consider the context of each element (e.g., its parent, siblings, and overall document structure) when determining the best Markdown representation.

* Output should be a single, cohesive Markdown document.

* Do not add any other text or comments.

Here is the webpage content: ${content}
`;

const formatContent = ({
  title,
  content,
  url
}: {
  title: string;
  content: string;
  url: string;
}) => {
  return `---\ntitle: ${title}\nurl: ${url}\ntimestamp: ${new Date().toISOString()}\n---\n${content}`;
};

export type GenerateResponse = {
  data: string | null;
  error: string | null;
  code: ErrorCode | null;
  url: string | null;
};

export async function generateLlmTxtAction(
  prevState: unknown,
  formData: FormData
): Promise<GenerateResponse> {
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

    // Sanitize URL
    const sanitizedUrl = validateAndSanitizeUrl(url);
    if (!sanitizedUrl.success) {
      return {
        data: null,
        error: "The provided URL is invalid. Please enter a valid URL.",
        code: "INVALID_URL",
        url,
      };
    }

    let webpageResponse;
    try {
      webpageResponse = await retry(() => fetch(url));

      if (!webpageResponse.ok) {
        throw new LLMTXTError(
          `Failed to fetch the webpage. Please check the URL and your internet connection.`,
          "FETCH_ERROR",
          webpageResponse.status
        );
      }
    } catch (error) {
      if (error instanceof LLMTXTError) {
        throw error;
      }
      throw new LLMTXTError(
        `Failed to fetch the webpage. Please check the URL and your internet connection.`,
        "FETCH_ERROR"
      );
    }

    // Parse HTML and extract content
    const html = await webpageResponse.text();
    const $ = cheerio.load(html);
    let title: string | null = null;
    let content: string | null = null;
    try {
      const extractedContent = extractContent($);
      title = extractedContent.title;
      content = extractedContent.content;
    } catch (error) {
      if (error instanceof LLMTXTError) {
        throw error;
      }
      throw new LLMTXTError(
        "Could not extract the main content from this webpage. It might be dynamically generated or require JavaScript to load.",
        "PARSE_ERROR"
      );
    }

    if (!content) {
      throw new LLMTXTError(
        "Could not extract the main content from this webpage. It might be dynamically generated or require JavaScript to load.",
        "PARSE_ERROR"
      );
    }

    const { text, finishReason } = await generateText({
      model: google("gemini-2.0-flash-lite-preview-02-05"),
      prompt: prompt(content),
    });

    if (finishReason === "error" || !text) {
      throw new LLMTXTError(
        "The AI model encountered an error while generating the content. Please try again later.",
        "AI_ERROR"
      );
    }

    revalidatePath("/");

    if (title && content) {
      return {
        data: formatContent({ title, content: text, url }),
        error: null,
        code: null,
        url,
      };
    }

    // Handle the case where title/content extraction failed
    return {
      data: null,
      error: "Could not extract title or content from the webpage.",
      code: "PARSE_ERROR",
      url,
    };
  } catch (error) {
    console.log(error);
    const handledError = handleError(error);
    return {
      data: null,
      error: handledError.message,
      code: handledError.code,
      url,
    };
  }
}
