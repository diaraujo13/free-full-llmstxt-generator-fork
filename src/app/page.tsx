import LlmsTxtGenerator from "@/components/llmstxt-generator";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-24">
    <div className="w-full max-w-4xl space-y-8">
      <LlmsTxtGenerator />
    </div>
  </main>
  );
}
