import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalCss = readFileSync("src/app/badge-layout.css", "utf8");
const profileCss = readFileSync("src/app/membres/[slug]/profile-badges.css", "utf8");
const collection = readFileSync("src/components/auth/badge-collection.tsx", "utf8");
const profile = readFileSync("src/components/member-public-profile.tsx", "utf8");

test("portrait badge artwork is pinned and contained inside its square frame", () => {
  assert.match(globalCss, /\.badge-art > img[\s\S]*position:absolute!important/);
  assert.match(globalCss, /width:100%!important[\s\S]*height:100%!important/);
  assert.match(globalCss, /object-fit:contain!important/);
});

test("secret badges form one shelf without appearing in regular state shelves", () => {
  assert.match(collection, /badges\.filter\(\(badge\) => !badge\.secret && badge\.state === state\)/);
  assert.match(collection, /badges\.filter\(\(badge\) => badge\.secret\)/);
  assert.match(collection, /label: "Badges secrets"/);
});

test("public badges occupy the site-owned right side of the member header", () => {
  assert.match(profile, /member-profile__identity[\s\S]*<MemberPublicBadges/);
  assert.match(profileCss, /grid-template-columns:max-content minmax\(0,1fr\) minmax\(250px,340px\)/);
  assert.match(profileCss, /member-profile>\.profile-badges[\s\S]*grid-column:3/);
  assert.match(profileCss, /@media\(max-width:820px\)/);
});
