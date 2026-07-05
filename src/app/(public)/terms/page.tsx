import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Hustle Bricks",
};

const EFFECTIVE_DATE = "July 2, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 lg:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Legal
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">The service</h2>
            <p className="text-muted-foreground">
              Hustle Bricks is business management software for home service businesses: clients,
              quotes, jobs, scheduling, team coordination, and payments. By creating an account or
              using the service you agree to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Your account</h2>
            <p className="text-muted-foreground">
              You are responsible for your account credentials and for the actions of team members
              you invite. Keep your access codes private; you can regenerate them at any time from
              Settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Your content</h2>
            <p className="text-muted-foreground">
              The business records you create remain yours. You grant us the limited rights needed
              to store and process them so the product works. You are responsible for the accuracy
              of the information you enter and for having the right to store your clients&apos;
              details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Payments</h2>
            <p className="text-muted-foreground">
              Card payments are processed by Stripe under their terms. Subscription fees, where
              applicable, are billed in advance and are non-refundable except where required by
              law. You are responsible for taxes that apply to payments you collect from your own
              customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Messaging</h2>
            <p className="text-muted-foreground">
              Where you use SMS or email features, you confirm you have consent to contact the
              recipients and will comply with applicable messaging laws (e.g. TCPA, CAN-SPAM).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Acceptable use</h2>
            <p className="text-muted-foreground">
              Don&apos;t misuse the service: no unlawful content, no attempts to breach security or
              access other businesses&apos; data, no reselling without our agreement. We may suspend
              accounts that put the service or other customers at risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Disclaimers &amp; liability</h2>
            <p className="text-muted-foreground">
              The service is provided &quot;as is&quot;. To the maximum extent permitted by law, we
              disclaim implied warranties and our aggregate liability is limited to the amounts you
              paid us in the twelve months before the claim. We are not liable for indirect or
              consequential damages, or for disputes between you and your customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Termination</h2>
            <p className="text-muted-foreground">
              You can stop using the service and delete your account at any time from Settings. We
              may terminate or suspend access for material breach of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms: <span className="font-medium text-foreground">support@hustlebricks.com</span>
            </p>
          </section>

          <p className="text-xs text-muted-foreground/70 border-t border-border pt-6">
            We may update these terms as the product evolves; material changes will be announced in
            the app. Continued use after changes take effect constitutes acceptance.
          </p>
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            ← Back to Hustle Bricks
          </Link>
        </div>
      </div>
    </div>
  );
}
