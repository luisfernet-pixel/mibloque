import { NextResponse } from "next/server";

export async function POST(req: Request) {
  return NextResponse.redirect(new URL("/api/vecino/reportar-pago", req.url), 307);
}
