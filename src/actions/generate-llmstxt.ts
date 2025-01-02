"use server";

import { ErrorCode, handleError, LLMTXTError } from "@/lib/errors";
import { ratelimit } from "@/lib/rate-limit";
import { validateAndSanitizeUrl } from "@/lib/security";
import { extractContent } from "@/lib/utils";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as cheerio from "cheerio";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const prompt = (
  content: string
) => `You are an expert webpage content formatter for creating high-quality Markdown suitable for training or providing context to large language models (LLMs). Your task is to convert input webpage content into clean, well-structured Markdown, paying meticulous attention to preserving semantic meaning and important formatting cues using Markdown syntax. Specifically:

* Maintain code blocks exactly as they appear in the source, using Markdown fenced code blocks (\`\`\`). Clearly identify the language if specified after the opening \`\`\`.

* Structure the content logically using Markdown headings (#, ##, ###, etc), Markdown lists (*, -, or + for unordered; 1., 2. for ordered), and Markdown blockquotes (>).

* Preserve emphasis (important information or distinct elements) using Markdown bold (**text** or __text__) and italics (*text* or _text_) syntax.

* Convert HTML links into Markdown links ([link text](href_url)). eg: <a href="https://example.com">link text</a> -> [link text](https://example.com) or <a href="/about">link text</a> -> [link text](/about). No need to add placeholder for relative URLs

* Convert HTML \`<img>\` tags to Markdown image syntax (\`![alt text](image_url)\`). eg: <img src="https://example.com/image.jpg" alt="alt text"> -> ![alt text](https://example.com/image.jpg) or <img src="/image.jpg" alt="alt text"> -> ![alt text](/image.jpg). No need to add placeholder for relative URLs

* Convert HTML \`<table>\` elements to Markdown tables. Strive for readability. If complex table structures are encountered, prioritize preserving the data accurately, even if the visual formatting isn't perfectly replicated in Markdown.

* Ensure clear separation between paragraphs (using blank lines) and sections for optimal readability by AI agents.

* Favor semantic Markdown structure over replicating visual presentation. Use appropriate Markdown elements to convey meaning.

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
        error: sanitizedUrl.error.errors[0].message,
        code: "INVALID_URL",
        url,
      };
    }

    const webpageResponse = await fetch(url);

    if (!webpageResponse.ok) {
      throw new LLMTXTError(
        `Failed to fetch webpage: ${webpageResponse.statusText}`,
        "FETCH_ERROR",
        webpageResponse.status
      );
    }

    // Parse HTML and extract content
    const html = await webpageResponse.text();
    const $ = cheerio.load(html);
    const { title, content } = extractContent($);
    if (!content) {
      throw new LLMTXTError(
        "No content found on webpage. The page might be empty or require JavaScript to load.",
        "PARSE_ERROR"
      );
    }

    const { text, finishReason } = await generateText({
      model: google("gemini-1.5-flash-8b"),
      prompt: prompt(content)
    });

    if (finishReason === "error" || !text) {
      throw new LLMTXTError(
        "Failed to generate markdown content. The AI model encountered an error.",
        "AI_ERROR"
      );
    }

    revalidatePath("/");

    return {
      data: formatContent({ title, content: text, url }),
      error: null,
      code: null,
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
