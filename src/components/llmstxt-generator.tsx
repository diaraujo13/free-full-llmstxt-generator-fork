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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [applyPrefixFilter, setApplyPrefixFilter] = useState(false);
  const [filterPrefix, setFilterPrefix] = useState<string | null>(null);
  const [generationStats, setGenerationStats] = useState<{ size: number; seconds: number; words: number } | null>(null);

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
    setApplyPrefixFilter(false);
    setFilterPrefix(null);
    setGenerationStats(null);
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
    // Set filter prefix from the pasted URL
    const pastedUrl = formData.get("url")?.toString() || "";
    try {
      const urlObj = new URL(pastedUrl);
      setFilterPrefix(urlObj.origin + urlObj.pathname.replace(/\/$/, ""));
    } catch {}
    setIsFullLoading(false);
  };

  // Filtering logic
  useEffect(() => {
    if (applyPrefixFilter && filterPrefix && foundUrls.length > 0) {
      const regex = new RegExp(`^${filterPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      setSelectedUrls(foundUrls.filter(u => regex.test(u.url)).map(u => u.url));
    }
  }, [applyPrefixFilter, filterPrefix, foundUrls]);

  const handleUrlToggle = (url: string) => {
    setSelectedUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleFullConfirm = async () => {
    setIsFullLoading(true);
    setFullError(null);
    setFullContent(null);
    setDownloadUrl(null);
    setProgress(0);
    setProgressTotal(selectedUrls.length);
    setGenerationStats(null);
    const start = Date.now();
    // Simulate progress (since backend is not streaming progress)
    let estimated = 0;
    const interval = setInterval(() => {
      estimated += 1;
      setProgress((prev) => {
        if (prev < selectedUrls.length) return prev + 1;
        return prev;
      });
    }, 1200);
    const formData = new FormData();
    selectedUrls.forEach(url => formData.append("urls", url));
    const res = await generateLlmsFullTxtAction(null, formData);
    clearInterval(interval);
    setProgress(selectedUrls.length);
    if (res.error) {
      setFullError(res.error);
      setIsFullLoading(false);
      return;
    }
    setFullContent(res.content || "");
    if (res.downloadUrl) setDownloadUrl(res.downloadUrl);
    // Fetch file size and word count
    if (res.downloadUrl) {
      try {
        const fileRes = await fetch(res.downloadUrl);
        const text = await fileRes.text();
        const size = new Blob([text]).size;
        const words = text.split(/\s+/).filter(Boolean).length;
        const seconds = ((Date.now() - start) / 1000).toFixed(1);
        setGenerationStats({ size, seconds: Number(seconds), words });
      } catch {}
    }
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
                    <label key={url} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox checked={selectedUrls.includes(url)} onCheckedChange={() => handleUrlToggle(url)} />
                      <div className="flex flex-col">
                        <span className="truncate font-medium" title={title}>{title}</span>
                        <span className="text-xs text-muted-foreground break-all">{url}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {/* Filter checkbox below action row */}
              {!isFullLoading && foundUrls.length > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <Checkbox
                    checked={applyPrefixFilter}
                    onCheckedChange={() => setApplyPrefixFilter(v => !v)}
                    id="prefix-filter"
                  />
                  <label htmlFor="prefix-filter" className="text-sm cursor-pointer select-none">
                    Only include links that start with <span className="font-mono text-xs bg-muted px-1 rounded">{filterPrefix}</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setShowFullModal(false)} disabled={isFullLoading}>Cancel</Button>
                <Button variant="default" onClick={handleFullConfirm} disabled={isFullLoading || selectedUrls.length === 0}>Confirm</Button>
              </div>
              {isFullLoading && (
                <div className="mt-4 w-full flex flex-col items-center">
                  <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                    <div
                      className="bg-primary h-4 rounded-full transition-all duration-500"
                      style={{ width: `${progressTotal ? (progress / progressTotal) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Processing {progress} of {progressTotal} links... ({progressTotal ? Math.round((progress / progressTotal) * 100) : 0}%)
                  </div>
                  <div className="mt-2 text-xs text-gray-400">This is an estimate. The file will be available for download when finished.</div>
                </div>
              )}
              {!isFullLoading && fullContent && (
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
              {!isFullLoading && downloadUrl && (
                <>
                  {generationStats && (
                    <div className="mb-4 p-3 rounded bg-green-100 text-green-800 border border-green-300 text-sm">
                      <strong>Success!</strong> Your file is ready.<br />
                      <span>Estimated size: <b>{(generationStats.size / 1024).toFixed(2)} KB</b> &middot; Generated in <b>{generationStats.seconds}s</b> &middot; <b>{generationStats.words}</b> words</span>
                    </div>
                  )}
                  <div className="mt-4">
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors font-semibold text-center"
                      download
                    >
                      Download Full LLMS.txt File
                    </a>
                  </div>
                </>
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
