import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.DASHBOARD_API_KEY || "";

export async function proxyGet(path: string, searchParams?: URLSearchParams) {
  const url = new URL(`${BACKEND_URL}${path}`);
  if (searchParams) {
    searchParams.forEach((v, k) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function proxyPost(path: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function proxyPatch(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
