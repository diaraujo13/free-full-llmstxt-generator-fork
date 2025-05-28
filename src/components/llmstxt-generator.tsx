"use client";

import { generateLlmTxtAction } from "@/actions/generate-llmstxt";
import { extractUrlsAction, generateLlmsFullTxtAction } from "@/actions/generate-llmsfulltxt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readStreamableValue, StreamableValue } from "ai/rsc";
import { AlertCircle } from "lucide-react";
import Form from "next/form";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { requestFormReset } from "react-dom";
import { ModeToggle } from "./mode-toggle";
import ResetButton from "./reset-button";
import { ResultActions } from "./result-actions";
import { SubmitButton } from "./submit-button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download } from "lucide-react";

const initialState = {
  data: null,
  error: null,
  code: null,
  url: null
};

// Wrapper component that holds the useActionState
function GeneratorContent({ onReset }: { onReset: () => void }) {
  const [state, formAction] = useActionState(generateLlmTxtAction, initialState);
  const [streamedContent, setStreamedContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const streamProcessedRef = useRef<boolean>(false);
  const preRef = useRef<HTMLPreElement>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const [foundUrls, setFoundUrls] = useState<{ url: string; title: string }[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [fullError, setFullError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Handle form reset
  const handleReset = async () => {
    streamProcessedRef.current = false;
    setStreamedContent(null);
    startTransition(() => {
      if (formRef.current) {
        requestFormReset(formRef.current);
      }
    });
    onReset(); // Call the parent's reset function to change the key
  };

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (preRef.current && isStreaming) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [streamedContent, isStreaming]);

  // Handle streamed content
  useEffect(() => {
    if (!state?.data || streamProcessedRef.current) return;
    const headerContent = `---\ntitle: ${state.url}\nurl: ${
      state.url
    }\ntimestamp: ${new Date().toISOString()}\n---\n`;
    if (state?.data) {
      let streamedContent = "";
      setIsStreaming(true);
      (async () => {
        for await (const delta of readStreamableValue(state.data as unknown as StreamableValue<string>)) {
          streamedContent += delta;
          const completeContent = headerContent + streamedContent;
          setStreamedContent(completeContent);
        }
        setIsStreaming(false);
        streamProcessedRef.current = true;
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.data]);

  useEffect(() => {
    return () => {
      setStreamedContent(null);
      setIsStreaming(false);
      streamProcessedRef.current = false;
    };
  }, []);

  const handleGenerateFull = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowFullModal(true);
    setFullError(null);
    setIsFullLoading(true);
    setFoundUrls([]);
    setSelectedUrls([]);
    setFullContent(null);
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const res = await extractUrlsAction(null, formData);
    if (res.error) {
      setFullError(res.error);
      setIsFullLoading(false);
      return;
    }
    setFoundUrls(res.urls);
    setSelectedUrls(res.urls.map((u: { url: string }) => u.url));
    setIsFullLoading(false);
  };

  const handleUrlToggle = (url: string) => {
    setSelectedUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleFullConfirm = async () => {
    setIsFullLoading(true);
    setFullError(null);
    setFullContent(null);
    const formData = new FormData();
    selectedUrls.forEach(url => formData.append("urls", url));
    const res = await generateLlmsFullTxtAction(null, formData);
    if (res.error) {
      setFullError(res.error);
      setIsFullLoading(false);
      return;
    }
    setFullContent(res.content || "");
    setIsFullLoading(false);
  };

  const handleCopyFull = async () => {
    if (!fullContent) return;
    await navigator.clipboard.writeText(fullContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const handleDownloadFull = () => {
    if (!fullContent) return;
    const blob = new Blob([fullContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "llms-full.txt";
    a.click();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Generate llms.txt
          </CardTitle>
          <ModeToggle />
        </div>
        <CardDescription>
          Enter a webpage url to generate llms.txt file that can be used for context or training
          purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form ref={formRef} action={formAction} className="flex gap-2.5" onReset={handleReset}>
          <Input
            type="url"
            name="url"
            defaultValue={state?.url || ""}
            placeholder="https://example.com"
            required
            className="flex-grow"
            disabled={isStreaming || isFullLoading}
          />
          {!isStreaming && streamedContent ? <ResetButton /> : <SubmitButton isStreaming={isStreaming} />}
          <Button
            type="button"
            className="btn btn-secondary"
            disabled={isStreaming || isFullLoading}
            onClick={handleGenerateFull}
          >
            Full LLMS.txt
          </Button>
        </Form>

        {state?.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error: {state.code}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {streamedContent && (
          <div className="mt-4 font-mono">
            <pre
              ref={preRef}
              className="bg-muted p-4 rounded-md overflow-y-auto max-h-96 text-sm whitespace-pre-wrap"
            >
              {streamedContent}
            </pre>
          </div>
        )}

        <Dialog open={showFullModal} onOpenChange={setShowFullModal}>
          <DialogContent onPointerDownOutside={e => e.preventDefault()}>
            <DialogTitle>Select URLs to include</DialogTitle>
            <DialogDescription>
              {isFullLoading && <div>Loading URLs...</div>}
              {fullError && <Alert variant="destructive" className="mt-2">{fullError}</Alert>}
              {!isFullLoading && foundUrls.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
                  {foundUrls.map(({ url, title }) => (
                    <label key={url} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedUrls.includes(url)} onCheckedChange={() => handleUrlToggle(url)} />
                      <span className="truncate" title={title}>{title}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline ml-2">link</a>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setShowFullModal(false)} disabled={isFullLoading}>Cancel</Button>
                <Button variant="default" onClick={handleFullConfirm} disabled={isFullLoading || selectedUrls.length === 0}>Confirm</Button>
              </div>
              {isFullLoading && <div className="mt-2">Generating full content...</div>}
              {fullContent && (
                <div className="mt-4 font-mono">
                  <pre
                    className="bg-muted p-4 rounded-md overflow-auto max-w-fit  max-h-60 text-sm whitespace-pre-wrap"
                    style={{ maxHeight: "15rem" }}
                  >
                    {fullContent}
                  </pre>
                  <div className="flex gap-4 mt-2">
                    <Button onClick={handleCopyFull} variant="outline" className="flex-1">
                      {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {isCopied ? "Copied" : "Copy"}
                    </Button>
                    <Button onClick={handleDownloadFull} variant="outline" className="flex-1">
                      <Download className="mr-2 h-4 w-4" /> Download
                    </Button>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </CardContent>

      {!isStreaming && streamedContent && <ResultActions result={streamedContent} />}
    </Card>
  );
}

export default function LlmsTxtGenerator() {
  const [resetKey, setResetKey] = useState(0);

  const handleResetKey = () => {
    setResetKey(prevKey => prevKey + 1);
  };

  useEffect(() => {
    return () => {
      setResetKey(0);
    };
  }, []);

  return <GeneratorContent key={resetKey} onReset={handleResetKey} />;
}
