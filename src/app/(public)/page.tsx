import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";
import AuthRecoveryRedirect from "@/components/AuthRecoveryRedirect";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return (
    <>
      <AuthRecoveryRedirect />
      <LandingPage />
    </>
  );
}
