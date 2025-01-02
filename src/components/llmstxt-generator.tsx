"use client";

import { generateLlmTxtAction } from "@/actions/generate-llmstxt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import Form from "next/form";
import { useActionState } from "react";
import { ModeToggle } from "./mode-toggle";
import { RemainingRequests } from "./remaining-requests";
import ResetButton from "./reset-button";
import { ResultActions } from "./result-actions";
import { SubmitButton } from "./submit-button";

const initialState = {
  data: null,
  error: null,
  code: null,
  url: null
};

export default function LlmsTxtGenerator({ remaining }: { remaining: number }) {
  const [state, formAction] = useActionState(generateLlmTxtAction, initialState);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            Generate llms.txt <RemainingRequests remaining={remaining} />
          </CardTitle>
          <ModeToggle />
        </div>
        <CardDescription>
          Enter a webpage URL to generate an llms.txt file that can be used for context or training
          purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form action={formAction} className="flex gap-2.5">
          <Input
            type="url"
            name="url"
            defaultValue={state?.url ?? ""}
            placeholder="https://example.com"
            required
            className="flex-grow"
          />
          {!state?.data ? <SubmitButton /> : <ResetButton />}
        </Form>

        {state?.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error: {state.code}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state?.data && (
          <div className="mt-4 font-mono">
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
              {state.data}
            </pre>
          </div>
        )}
      </CardContent>

      {state?.data && <ResultActions result={state.data} />}
    </Card>
  );
}
