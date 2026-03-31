import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AmbassadorAuth } from "./AmbassadorAuth";

export default function AmbassadorPage() {
  return (
    <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">Community Ambassador</h1>
        <p className="text-muted mt-2">
          Help your community by sharing local resources, events, and assistance programs.
          Ambassadors get a verified badge and can pin important posts.
        </p>
      </div>

      <AmbassadorAuth />
    </main>
  );
}
