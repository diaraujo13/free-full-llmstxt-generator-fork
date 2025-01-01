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
import { ErrorCode } from "@/lib/errors";
import { validateAndSanitizeUrl } from "@/lib/security";
import { AlertCircle, Check, Copy, Download, Loader2, WandSparkles } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { ModeToggle } from "./mode-toggle";

interface ErrorState {
  message: string;
  code: ErrorCode;
}

export default function LlmsTxtGenerator() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useOptimistic(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult("");

    try {
      // Validate and sanitize URL
      const sanitizedUrl = validateAndSanitizeUrl(url);

      const response = await generateLlmTxt({ url: sanitizedUrl });
      if (response.success) {
        setResult(response.data);
      } else {
        setError({ message: response.error, code: response.code });
      }
    } catch (err) {
      // This catch block handles URL validation errors
      const error = err instanceof Error ? err : new Error("An unexpected error occurred");
      setError({
        message: error.message,
        code: "VALIDATION_ERROR"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Generate llms.txt{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (5 requests remaining today)
            </span>
          </CardTitle>
          <ModeToggle />
        </div>
        <CardDescription>
          Enter a webpage URL to generate an llms.txt file that can be used for context or training
          purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value.trim())}
              placeholder="https://example.com"
              required
              className="flex-grow"
            />
            <Button type="submit" disabled={isLoading} data-umami-event="Generate">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </form>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error: {error.code}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {result && (
          <div className="mt-4 font-mono">
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">{result}</pre>
          </div>
        )}
      </CardContent>
      {result && (
        <CardFooter className="flex gap-2">
          <Button
            onClick={() => {
              startTransition(async () => {
                await navigator.clipboard.writeText(result);
                setIsCopied(true);
                await new Promise((resolve) => setTimeout(resolve, 1000));
              });
            }}
            className="flex-1"
            data-umami-event="Copy"
          >
            {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{" "}
            {isCopied ? "Copied" : "Copy"}
          </Button>
          <Button
            onClick={() => {
              const blob = new Blob([result], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "llms.txt";
              a.click();
            }}
            className="flex-1"
            data-umami-event="Download"
          >
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
