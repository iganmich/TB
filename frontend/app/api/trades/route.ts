import { NextRequest } from "next/server";
import { proxyGet } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  return proxyGet("/api/trades", req.nextUrl.searchParams);
}
