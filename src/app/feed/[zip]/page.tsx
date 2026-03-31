import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeedContent } from "./FeedContent";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ zip: string }>;
}) {
  const { zip } = await params;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return (
      <main className="flex-1 px-4 py-12 max-w-3xl mx-auto">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-foreground">Invalid zip code</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1 mt-4 text-primary hover:underline font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/results?zip=${zip}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to resources
        </Link>
        <Link
          href="/ambassador"
          className="text-sm text-primary hover:underline font-medium"
        >
          Become an Ambassador
        </Link>
      </div>

      <FeedContent zip={zip} />
    </main>
  );
}
