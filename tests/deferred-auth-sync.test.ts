import assert from "node:assert/strict";
import test from "node:test";

import { createDeferredAuthSync } from "../src/lib/supabase/deferred-auth-sync";

test("coalesces Supabase auth events outside the auth callback", async () => {
  let runs = 0;
  const sync = createDeferredAuthSync(() => {
    runs += 1;
  });

  sync.schedule();
  sync.schedule();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(runs, 1);
});

test("cancels a pending Supabase auth synchronization", async () => {
  let runs = 0;
  const sync = createDeferredAuthSync(() => {
    runs += 1;
  });

  sync.schedule();
  sync.cancel();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(runs, 0);
});
