"use server";

import { ErrorCode, handleError, LLMTXTError } from "@/lib/errors";
import { ratelimit } from "@/lib/rate-limit";
import { validateAndSanitizeUrl } from "@/lib/security";
import { extractContent, retry } from "@/lib/utils-server";
import { google } from "@ai-sdk/google";
import { smoothStream, streamText } from "ai";
import { createStreamableValue, StreamableValue } from "ai/rsc";
import * as cheerio from "cheerio";
import { headers } from "next/headers";

const prompt = (
  content: string
) => `You are an expert webpage content formatter for creating high-quality Markdown suitable for training or providing context to large language models (LLMs). Convert the webpage content into clean, well-structured Markdown, preserving semantic meaning and important formatting:

* **Code blocks**: Use fenced code blocks (\`\`\`) with language specified when available. Preserve indentation and syntax.

* **Headings**: Use # for <h1>, ## for <h2>, ### for <h3>, etc. Maintain heading hierarchy.

* **Lists**:
  * Use *, -, or + for unordered lists
  * Use 1., 2., etc. for ordered lists
  * Indent nested lists by 4 spaces per nesting level

* **Emphasis**: Use **bold** and *italics* to preserve emphasis from the original.

* **Blockquotes**: Use > at the beginning of each line for blockquotes.

* **Links**: Convert to [link text](URL) format. Preserve relative URLs.

* **Tables**: Convert to Markdown tables with header rows and column alignment.

* **Images**: Convert to ![alt text](image URL) format.

* **Mathematical notation**: Preserve using $ for inline and $$ for block equations if present.

* **Paragraphs**: Separate with blank lines for readability.

* **Clean content**: Remove navigation elements, ads, and other non-content elements.

* **Output format**: Produce a single cohesive Markdown document without adding any commentary.

Here is the webpage content: ${content}`;

export type GenerateResponse = {
  data: StreamableValue<string> | string | null;
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
      const extractedContent = await extractContent($);
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

    // Create a streamable value for the generated content
    const stream = createStreamableValue('');

    // Start the streaming process
    (async () => {
      try {
        const { textStream } = streamText({
          model: google("gemini-2.0-flash-lite"),
          prompt: prompt(content),
          experimental_transform: smoothStream({
            chunking: "line",
          })
        });

        for await (const delta of textStream) {
          stream.update(delta);
        }

        stream.done();
      } catch (error) {
        console.error("Streaming error:", error);
        stream.error(new LLMTXTError(
          "The AI model encountered an error while generating the content. Please try again later.",
          "AI_ERROR"
        ));
      }
    })();

    if (title && content) {
      return {
        data: stream.value,
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