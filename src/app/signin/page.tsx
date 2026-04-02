import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-foreground text-center mb-6">
          Join the community
        </h1>
        <p className="text-sm text-muted text-center mb-6">
          Sign in to vote on resources, post comments, and contribute to your local feed.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
