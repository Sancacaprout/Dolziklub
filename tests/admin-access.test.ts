import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const access = read("src/lib/admin-access.ts");
const endpoint = read("src/app/api/admin/access/route.ts");
const page = read("src/app/admin/page.tsx");
const header = read("src/components/site-header.tsx");
const list = read("src/app/admin/admin-member-list.tsx");
const proxy = read("src/proxy.ts");

test("requires server-verified authentication and the current database role for the admin directory", () => {
  assert.match(access, /import "server-only"/);
  assert.match(access, /await client\.auth\.getUser\(\)/);
  assert.match(access, /from\("member_profiles"\)\.select\("role"\)\.eq\("id", user\.id\)/);
  assert.match(access, /data\?\.role === "admin"/);
  assert.doesNotMatch(access, /getSession|app_metadata|user_metadata|SERVICE_ROLE/);
  assert.match(page, /if \(access\.status === "signed-out"\) redirect\("\/connexion"\)/);
  assert.match(page, /if \(access\.status === "forbidden"\) notFound\(\)/);
  assert.match(page, /access\.status !== "admin"[\s\S]*?<MemberDirectory access=\{access\}/);
  assert.match(page, /profile\.id === actorId && profile\.role === "admin"/);
});

test("exposes only an uncached access flag and hides ADMIN until the server confirms it", () => {
  assert.match(endpoint, /"signed-out": 401, forbidden: 403, unavailable: 503/);
  assert.match(endpoint, /NextResponse\.json\(\{ admin: status === "admin" \}/);
  assert.match(endpoint, /"Cache-Control": "private, no-store"/);
  assert.match(header, /\[isAdmin, setIsAdmin\] = useState\(false\)/);
  assert.match(header, /fetch\("\/api\/admin\/access"/);
  assert.match(header, /setIsAdmin\(result\?\.admin === true\)/);
  assert.match(header, /\{isAdmin \? <Link[^>]*href="\/admin" prefetch=\{false\}/);
  assert.match(proxy, /Object\.entries\(headers\)/);
});

test("keeps assistance disabled and retires the old concept route", () => {
  assert.match(list, /type="button" disabled aria-describedby="member-assistance-status"/);
  assert.match(list, /normalize\(member\.username\)\.includes\(query\)/);
  assert.doesNotMatch(header, /href="\/concept"|Le concept/);
  assert.doesNotMatch(read("src/components/footer.tsx"), /href="\/concept"/);
  assert.doesNotMatch(read("src/data/site-updates.ts"), /href: "\/concept"/);
  assert.equal(existsSync(new URL("../src/app/concept/page.tsx", import.meta.url)), false);
});
