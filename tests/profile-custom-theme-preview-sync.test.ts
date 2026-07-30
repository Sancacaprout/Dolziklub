import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editorSource = readFileSync(
  new URL(
    "../src/components/auth/custom-theme-editor/custom-theme-editor.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("live preview updates are not gated by the visual ready indicator", () => {
  assert.match(
    editorSource,
    /useEffect\(\(\) => \{[\s\S]*?postPreview\(config, assetMap\);\s*\}, \[assetMap, config, postPreview\]\);/,
  );
  assert.doesNotMatch(
    editorSource,
    /if\s*\(previewReady\)\s*postPreview\(config, assetMap\)/,
  );
});

test("a late iframe load event cannot invalidate a completed handshake", () => {
  assert.doesNotMatch(
    editorSource,
    /onLoad=\{\(\) => \{\s*setPreviewReady\(false\)/,
  );
});
