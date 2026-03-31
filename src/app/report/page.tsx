import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReportForm } from "./ReportForm";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const zip = typeof params.zip === "string" ? params.zip : "";

  return (
    <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
      <Link
        href={zip ? `/results?zip=${zip}` : "/"}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {zip ? "Back to results" : "Back to home"}
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Report an Issue</h1>
      <p className="text-muted mt-2 text-sm">
        Submit an anonymous report about conditions in your area. Reports help us and
        local organizations understand community needs.
      </p>

      <div className="mt-6">
        <ReportForm initialZip={zip} />
      </div>
    </main>
  );
}
