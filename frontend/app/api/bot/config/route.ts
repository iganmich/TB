import { NextRequest } from "next/server";
import { proxyGet, proxyPatch } from "@/lib/proxy";

export async function GET() {
  return proxyGet("/api/bot/config");
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return proxyPatch("/api/bot/config", body);
}
