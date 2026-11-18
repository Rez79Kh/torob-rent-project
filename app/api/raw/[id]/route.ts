import { NextResponse } from "next/server";
import { rawById } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = rawById(id);
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(raw, { headers: { "Cache-Control": "public, max-age=3600" } });
}
