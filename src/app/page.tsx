import { Search, ShieldCheck, Heart, Smartphone } from "lucide-react";
import { ZipInput } from "@/components/ZipInput";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <h1 className="text-3xl sm:text-5xl font-bold text-center text-foreground max-w-2xl leading-tight">
            What help is available near you?
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted text-center max-w-xl">
            Enter your zip code to find free and low-cost assistance programs for
            food, housing, employment, healthcare, and more.
          </p>
          <div className="mt-8 w-full max-w-md px-4">
            <ZipInput />
          </div>
        </section>

        {/* Explainer */}
        <section className="bg-muted-bg py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-semibold text-center mb-8">
              How Resrc helps
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                  <Search className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Find local resources instantly
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Search by zip code to see national, state, and local
                    assistance programs available in your area.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                  <ShieldCheck
                    className="w-5 h-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Verified &amp; up to date
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Every resource links to an official program page. We verify
                    links regularly so you never hit a dead end.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    100% free, no tracking
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    No accounts, no cookies, no analytics. We never collect or
                    sell your data. Period.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                  <Smartphone
                    className="w-5 h-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Built for mobile
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    Click-to-call phone numbers, easy navigation, and fast
                    loading — even on slow connections.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 text-center text-sm text-muted border-t border-border">
        <div className="flex justify-center gap-4">
          <Link href="/about" className="hover:text-foreground transition-colors">
            About
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
        </div>
        <p className="mt-2">
          Resrc is free and open source.
        </p>
      </footer>
    </>
  );
}
