import { SubmitResourceForm } from "./SubmitResourceForm";

export default function SubmitPage() {
  return (
    <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-foreground">Submit a Resource</h1>
      <p className="mt-2 text-sm text-muted">
        Know of a program that helps people in your area? Submit it here and our
        moderators will review it for inclusion.
      </p>
      <div className="mt-6">
        <SubmitResourceForm />
      </div>
    </main>
  );
}
