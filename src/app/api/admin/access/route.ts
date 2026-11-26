import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const { status } = await getAdminAccess();
  const httpStatus = { admin: 200, "signed-out": 401, forbidden: 403, unavailable: 503 }[status];
  return NextResponse.json({ admin: status === "admin" }, {
    status: httpStatus,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
