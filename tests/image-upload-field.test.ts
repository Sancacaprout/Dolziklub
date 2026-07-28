import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/image-upload-field.tsx", "utf8");
const styles = readFileSync("src/app/upload-fields.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const consumers = [
  "src/components/album-editorial-editor.tsx",
  "src/components/auth/account-panel.tsx",
  "src/components/auth/favorite-artists-panel.tsx",
  "src/components/meme-gallery.tsx",
  "src/components/music-selection-cards.tsx",
  "src/components/tableur-board.tsx",
].map((path) => readFileSync(path, "utf8"));

test("all six image entry points reuse the accessible upload field", () => {
  for (const source of consumers) assert.match(source, /<ImageUploadField/);
  assert.equal(consumers.filter((source) => /type="file"/.test(source)).length, 0);
  assert.equal((component.match(/type="file"/g) ?? []).length, 1);
  assert.match(layout, /import "\.\/upload-fields\.css"/);
});

test("the real file input stays keyboard accessible while native chrome is hidden", () => {
  assert.match(component, /className="image-upload-field__input"/);
  assert.match(component, /htmlFor=\{id\}/);
  assert.match(component, /aria-labelledby=\{labelId\}/);
  assert.match(component, /aria-describedby=\{describedBy\}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /role="alert"/);
  assert.match(styles, /image-upload-field__input:focus-visible \+ \.image-upload-field__button/);
});

test("selection validates locally, previews square images and releases Blob URLs", () => {
  assert.match(component, /allowedTypes\.includes\(nextFile\.type\)/);
  assert.match(component, /nextFile\.size > maxSizeBytes/);
  assert.match(component, /URL\.createObjectURL\(nextFile\)/);
  assert.match(component, /URL\.revokeObjectURL\(previewUrlRef\.current\)/);
  assert.match(styles, /image-upload-field__preview[^}]*aspect-ratio:1/);
  assert.match(styles, /image-upload-field__preview img[^}]*object-fit:cover/);
});

test("the shared field keeps the existing upload contracts visible", () => {
  const joined = consumers.join("\n");
  assert.match(joined, /member-avatars/);
  assert.match(joined, /album-covers/);
  assert.match(joined, /profile-favorites/);
  assert.match(joined, /meme-uploads/);
  assert.match(joined, /3 \* 1024 \* 1024/);
  assert.match(joined, /5 \* 1024 \* 1024/);
});

test("choosing an artist portrait waits for the existing podium save action", () => {
  const favoriteArtists = consumers[2];
  assert.match(favoriteArtists, /file=\{portraitFiles\[rank\] \?\? null\}/);
  assert.match(favoriteArtists, /onFileChange=\{\(file\) => setPortraitFiles/);
  assert.match(favoriteArtists, /for \(const rank of \(\[1, 2, 3\] as Rank\[\]\)\)/);
  assert.match(favoriteArtists, /await uploadPortrait\(/);
  assert.doesNotMatch(favoriteArtists, /onFileChange=\{[^}]*uploadPortrait/);
});
