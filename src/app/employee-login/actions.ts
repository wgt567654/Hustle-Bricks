"use server";

export async function checkEmailExists(email: string): Promise<boolean> {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`
  );
  url.searchParams.set("email", email);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
  });

  if (!res.ok) return false;

  const json = await res.json();
  return Array.isArray(json.users) && json.users.length > 0;
}
