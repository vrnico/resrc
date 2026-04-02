import Link from "next/link";
import GitHubContributors from "@/components/GitHubContributors";

export default function AboutPage() {
  return (
    <main className="flex-1 px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground">About Resrc</h1>

      <div className="mt-6 space-y-4 text-foreground leading-relaxed">
        <p>
          Resrc is a free web application that helps people in the United
          States find verified assistance programs for food, housing,
          employment, healthcare, transportation, and more — all by entering a
          zip code.
        </p>

        <h2 className="text-xl font-semibold pt-4">Why we built this</h2>
        <p>
          Millions of people qualify for assistance programs but never access
          them — often because they don't know the programs exist or can't
          navigate the fragmented system. Resrc puts everything in one place,
          organized by location and category, with direct links to official
          program pages.
        </p>

        <h2 className="text-xl font-semibold pt-4">What makes us different</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Free forever.</strong> No subscriptions, no premium tiers, no
            paywalls.
          </li>
          <li>
            <strong>No tracking.</strong> We don't use cookies, analytics, or any
            third-party scripts. We don't collect or sell your data.
          </li>
          <li>
            <strong>Verified resources.</strong> Every listing links to a real,
            official program. We check links regularly and remove broken ones.
          </li>
          <li>
            <strong>Open source.</strong> Our code is publicly available. Anyone
            can review it, suggest improvements, or report issues.
          </li>
          <li>
            <strong>Community-powered.</strong> Local community feeds let people
            share tips and information anonymously.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">How our data works</h2>
        <p>
          We compile resources from official government sources, verified
          nonprofits, and established organizations. Each resource is tagged with
          its geographic scope (national, state, or local) and mapped to the zip
          codes it serves. Eligibility summaries are written in plain language.
        </p>

        <h2 className="text-xl font-semibold pt-4">Our team</h2>
        <p>
          Resrc is built, deployed, and maintained by developers from{" "}
          <a
            href="https://themultiverse.school"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            The Multiverse School
          </a>
          .
        </p>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Contributors &amp; Collaborators
          </h3>
          <GitHubContributors />
        </div>

        <h2 className="text-xl font-semibold pt-4">Contact</h2>
        <p>
          If you notice a broken link, a missing program, or have suggestions,
          you can submit a report through the site or contribute through our{" "}
          <a
            href="https://github.com/vrnico/resrc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            open source repository
          </a>
          .
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <Link
          href="/"
          className="text-primary hover:underline font-medium"
        >
          &larr; Back to home
        </Link>
      </div>
    </main>
  );
}
