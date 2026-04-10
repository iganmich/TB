import { proxyPost } from "@/lib/proxy";

export async function POST() {
  return proxyPost("/api/bot/start");
}
