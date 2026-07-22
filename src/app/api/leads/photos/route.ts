import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validation";

// Public photo upload for quote/lead intake. Files land in the existing
// "lead-photos" bucket; the returned URLs are then passed as photo_urls to
// /api/quotes/request or /api/leads/submit, which attach them to the lead.
// Uploads not followed by a submission are orphaned in storage — acceptable
// at these limits, and cheaper than a signed-URL handshake for v1.

const MAX_PHOTOS = 8;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB per file (pre-compression)

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  // Uploads are heavier than form submits — tighter window than leads/submit.
  const rl = rateLimit(`leads-photos:${getClientIp(req)}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const businessId = form.get("business_id");
  if (!isUuid(businessId)) {
    return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  }

  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `At most ${MAX_PHOTOS} photos per upload` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Each photo must be under 10MB" },
        { status: 400 }
      );
    }
    if (!EXT_BY_TYPE[f.type]) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, GIF, or HEIC images are allowed" },
        { status: 400 }
      );
    }
  }

  const supabase = adminClient();

  // Verify the business exists (prevents uploads against fake business IDs)
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .single();

  if (bizError || !biz) {
    return NextResponse.json({ error: "Invalid business" }, { status: 404 });
  }

  const urls: string[] = [];
  for (const file of files) {
    const path = `${businessId}/intake-${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
    const { error } = await supabase.storage
      .from("lead-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      return NextResponse.json(
        { error: "Upload failed, please try again" },
        { status: 500 }
      );
    }
    const { data } = supabase.storage.from("lead-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ urls });
}
