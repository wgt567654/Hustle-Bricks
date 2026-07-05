import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Hustle Bricks",
};

const EFFECTIVE_DATE = "July 2, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 lg:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Legal
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Effective {EFFECTIVE_DATE}
        </p>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Who we are</h2>
            <p className="text-muted-foreground">
              Hustle Bricks (&quot;we&quot;, &quot;us&quot;) provides business management software for home
              service businesses. This policy describes what we collect, why, and the choices you
              have. It applies to the Hustle Bricks web application and websites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">What we collect</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1.5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Account data</span> — name, email,
                password (stored as a secure hash), and business details you provide.
              </li>
              <li>
                <span className="font-medium text-foreground">Business records you create</span> —
                clients, quotes, jobs, schedules, payments metadata, team information, and messages.
              </li>
              <li>
                <span className="font-medium text-foreground">Payment information</span> — card
                payments are processed by Stripe; we never store full card numbers. We keep records
                of amounts, dates, and payment status.
              </li>
              <li>
                <span className="font-medium text-foreground">Usage data</span> — log and device
                information used to keep the service secure and reliable.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">How we use it</h2>
            <p className="text-muted-foreground">
              To operate the product: showing your schedule, sending the messages and reminders you
              trigger, processing payments, and keeping your account secure. We do not sell your
              personal information. Your business records belong to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Service providers</h2>
            <p className="text-muted-foreground">
              We rely on a small set of processors to run the service: Supabase (database and
              authentication), Stripe (payments), Resend (email delivery), Twilio (SMS), Google
              (calendar sync and maps, when you connect them), and our hosting provider. Each
              receives only what it needs to perform its function.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Your clients&apos; data</h2>
            <p className="text-muted-foreground">
              When you store client details in Hustle Bricks, you are responsible for having the
              right to do so. We process that data on your instructions and protect it the same way
              we protect your account data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Retention &amp; deletion</h2>
            <p className="text-muted-foreground">
              We keep your data while your account is active. You can delete your account from
              Settings, which permanently removes your business data from our systems, subject to
              records we must keep for legal or financial compliance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Your rights</h2>
            <p className="text-muted-foreground">
              Depending on where you live, you may have rights to access, correct, export, or delete
              your personal information. Contact us and we&apos;ll honor them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight mb-2">Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy: <span className="font-medium text-foreground">support@hustlebricks.com</span>
            </p>
          </section>

          <p className="text-xs text-muted-foreground/70 border-t border-border pt-6">
            We may update this policy as the product evolves; material changes will be announced in
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
