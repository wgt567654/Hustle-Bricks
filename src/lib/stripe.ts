import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

/** Platform fee in basis points (e.g. 200 = 2%). Set via PLATFORM_FEE_BPS env var. */
export const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS ?? "200", 10);

/** Compute the platform application fee in cents given a total in cents. */
export function platformFeeAmount(totalCents: number): number {
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10000);
}
