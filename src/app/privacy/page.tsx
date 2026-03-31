import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-muted text-sm">Last updated: March 2026</p>

      <div className="mt-6 space-y-4 text-foreground leading-relaxed">
        <p>
          Resrc is designed to protect your privacy. Here is exactly what we
          do and don't do with your information, in plain language.
        </p>

        <h2 className="text-xl font-semibold pt-4">What we don't collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>No accounts.</strong> You never need to sign up or log in to
            use Resrc.
          </li>
          <li>
            <strong>No cookies.</strong> We don't set any cookies on public
            pages. The only cookie is a session cookie for administrators.
          </li>
          <li>
            <strong>No IP logging.</strong> We do not record your IP address on
            any public-facing page or API endpoint.
          </li>
          <li>
            <strong>No analytics.</strong> No Google Analytics, no Facebook
            pixel, no tracking scripts of any kind.
          </li>
          <li>
            <strong>No third-party scripts.</strong> We don't load any external
            JavaScript on public pages.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">Zip code searches</h2>
        <p>
          When you search for a zip code, we use it only to look up relevant
          resources. We do not store your search history or associate searches
          with any identifier.
        </p>

        <h2 className="text-xl font-semibold pt-4">Community posts</h2>
        <p>
          Community feed posts are anonymous. We use a temporary browser
          fingerprint — a one-way hash that cannot identify you — solely to
          prevent spam (e.g., limiting posts to 5 per hour). This fingerprint
          rotates daily and is never stored permanently.
        </p>

        <h2 className="text-xl font-semibold pt-4">Anonymous reports</h2>
        <p>
          Reports are fully anonymous. We do not log your IP or use any
          fingerprinting on report submissions. If you choose to provide
          contact information for follow-up, it is encrypted on your device
          before being sent to our server. Only designated administrators can
          decrypt it.
        </p>

        <h2 className="text-xl font-semibold pt-4">Data retention</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Community posts are archived after 90 days.</li>
          <li>
            Reports are retained indefinitely as they may have legal or advocacy
            value.
          </li>
          <li>
            Fingerprint hashes are rotated daily and not stored beyond the rate
            limit window.
          </li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">Questions</h2>
        <p>
          If you have questions about this policy, you can reach us through the
          report system on the site or through our open source repository.
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
