"use client";

import { generateLlmTxt } from "@/actions/generate-llmstxt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LLMTXTError } from "@/lib/errors";
import { validateAndSanitizeUrl } from "@/lib/security";
import { extractContent } from "@/lib/utils";
import { GenerationStatus } from "@/types";
import * as cheerio from "cheerio";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { ModeToggle } from "./mode-toggle";

export default function LlmsTxtGenerator() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GenerationStatus>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResult("");

    try {
      // Validate and sanitize URL
      const sanitizedUrl = validateAndSanitizeUrl(url);
      setStatus("fetching");
      // Fetch webpage
      const webpageResponse = await fetch(sanitizedUrl);
      if (!webpageResponse.ok) {
        throw new LLMTXTError("Failed to fetch webpage", "FETCH_ERROR", webpageResponse.status);
      }

      // Parse HTML and extract content
      setStatus("parsing");
      const html = await webpageResponse.text();
      const $ = cheerio.load(html);
      const { title, content } = extractContent($);
      setStatus("formatting");
      const response = await generateLlmTxt({ title, content, url });
      if (response.success) {
        setResult(response.data!);
        setStatus("complete");
      } else {
        console.log(response.error);
        throw new LLMTXTError("Failed to generate llms.txt", "AI_ERROR", 500);
      }
    } catch (error) {
      setStatus("error");
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Generate llms.txt</CardTitle>
          <ModeToggle />
        </div>
        <CardDescription>
          Enter a webpage URL to generate a markdown friendly llms.txt file
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              className="flex-grow"
            />
            <Button type="submit" disabled={isLoading} data-umami-event="Generate">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </form>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {result && (
          <div className="mt-4">
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">{result}</pre>
          </div>
        )}
      </CardContent>
      {result && (
        <CardFooter>
          <Button
            onClick={() => {
              const blob = new Blob([result], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "llms.txt";
              a.click();
            }}
            className="w-full"
            data-umami-event="Download"
          >
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
