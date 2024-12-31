"use server";

import { handleError, LLMTXTError } from "@/lib/errors";
import { extractContent } from "@/lib/utils";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import * as cheerio from "cheerio";
const prompt = (content: string) =>
  `You are an expert webpage content formatter for creating high-quality Markdown suitable for training or providing context to large language models (LLMs). Your task is to convert input webpage content into clean, well-structured Markdown, paying meticulous attention to preserving semantic meaning and important formatting cues using Markdown syntax. Specifically:

* Maintain code blocks exactly as they appear in the source, using Markdown fenced code blocks (\`\`\`). Clearly identify the language if specified after the opening \`\`\`.

* Structure the content logically using Markdown headings (#, ##, ###, etc), Markdown lists (*, -, or + for unordered; 1., 2. for ordered), and Markdown blockquotes (>).

* Preserve emphasis (important information or distinct elements) using Markdown bold (**text** or __text__) and italics (*text* or _text_) syntax.

* Convert HTML links into Markdown links ([link text](url)).

* Ensure clear separation between paragraphs (using blank lines) and sections for optimal readability by AI agents.

* Favor semantic Markdown structure over replicating visual presentation. Use appropriate Markdown elements to convey meaning.

* Output should be a single, cohesive Markdown document.

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

export async function generateLlmTxt({ url }: { url: string }) {
  try {
    const webpageResponse = await fetch(url);
    if (!webpageResponse.ok) {
      throw new LLMTXTError("Failed to fetch webpage", "FETCH_ERROR", webpageResponse.status);
    }

    // Parse HTML and extract content
    const html = await webpageResponse.text();
    const $ = cheerio.load(html);
    const { title, content } = extractContent($);

    if (!content) {
      throw new LLMTXTError("No content found on webpage", "PARSE_ERROR");
    }

    const { text, finishReason } = await generateText({
      model: google("gemini-1.5-flash-8b"),
      prompt: prompt(content)
    });

    if (finishReason === "error") {
      throw new LLMTXTError("An error occurred while formatting the webpage content", "AI_ERROR");
    }

    // Return stream with error handling
    return {
      success: true,
      data: formatContent({ title, content: text, url })
    };
  } catch (error) {
    const handledError = handleError(error);
    return { success: false, error: handledError.message };
  }
}
