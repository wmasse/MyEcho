import { get } from "@vercel/blob";
import { normalizeSharedEcho } from "@/lib/shared-echo";

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!SHARE_ID_PATTERN.test(id)) {
    return Response.json(
      { error: "This Echo could not be found." },
      { status: 404 }
    );
  }

  try {
    const blob = await get(
      `shared-echoes/${id}.json`,
      { access: "private" }
    );

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return Response.json(
        { error: "This Echo could not be found." },
        { status: 404 }
      );
    }

    const storedEcho: unknown = await new Response(blob.stream).json();
    const echo = normalizeSharedEcho(storedEcho);

    if (!echo) {
      return Response.json(
        { error: "This Echo could not be found." },
        { status: 404 }
      );
    }

    return Response.json(echo, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Could not load shared Echo:", error);

    return Response.json(
      { error: "Echo sharing is temporarily unavailable." },
      { status: 503 }
    );
  }
}
