import { Footer } from "@/components/footer";
import LlmsTxtGenerator from "@/components/llmstxt-generator";
import { ratelimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export default async function Home() {
  const headersList = await headers();
  const identifier = headersList.get("cf-connecting-ip") ?? headersList.get("x-real-ip") ?? headersList.get("x-forwarded-for") ?? "127.0.0.1";
  const { remaining } = await ratelimit.getRemaining(identifier);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-24">
    <div className="w-full max-w-4xl space-y-8">
      <LlmsTxtGenerator remaining={remaining} />
    </div>
    <Footer />
  </main>
  );
}
