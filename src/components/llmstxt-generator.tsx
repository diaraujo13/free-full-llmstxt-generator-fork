"use client";

import { generateLlmTxtAction } from "@/actions/generate-llmstxt";
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
        for await (const delta of readStreamableValue(state.data as StreamableValue<string>)) {
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
            disabled={isStreaming}
          />
          {!isStreaming && streamedContent ? <ResetButton /> : <SubmitButton isStreaming={isStreaming} />}
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
