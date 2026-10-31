import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { normalizeSharedEcho } from "@/lib/shared-echo";

const MAX_REQUEST_BYTES = 256_000;

function createShareId() {
  return randomBytes(16).toString("base64url");
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    const text = await request.text();

    if (
      new TextEncoder().encode(text).byteLength >
      MAX_REQUEST_BYTES
    ) {
      return Response.json(
        { error: "This Echo is too large to share." },
        { status: 413 }
      );
    }

    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "The Echo data could not be read." },
      { status: 400 }
    );
  }

  const echo = normalizeSharedEcho(body);

  if (!echo || echo.tracks.length === 0) {
    return Response.json(
      { error: "This Echo could not be shared." },
      { status: 400 }
    );
  }

  const id = createShareId();

  try {
    await put(
      `shared-echoes/${id}.json`,
      JSON.stringify(echo),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );

    return Response.json({ id });
  } catch (error) {
    console.error("Could not save shared Echo:", error);

    return Response.json(
      { error: "Echo sharing is temporarily unavailable." },
      { status: 503 }
    );
  }
}
