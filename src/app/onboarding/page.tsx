import { redirect } from "next/navigation";
import Container from "@/components/Container";
import { requireAdmin } from "@/lib/auth/server";
import { getOrgProfile } from "@/lib/storage/org";
import OnboardingClient from "@/app/onboarding/OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireAdmin();
  const profile = await getOrgProfile();
  if (profile.onboardingCompletedAt) redirect("/dashboard");

  return (
    <Container>
      <OnboardingClient initial={profile} />
    </Container>
  );
}

