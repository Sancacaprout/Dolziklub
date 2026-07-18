import test from "node:test";
import assert from "node:assert/strict";
import { getClubStats, getMemberStats, getRepresentedStyles, sortAlbums } from "../src/lib/statistics";
import { slugify } from "../src/lib/slug";
import type { Album } from "../src/types/album";
const album = (title: string, rating: number | null): Album => ({ id:title, slug:slugify(title), title, artist:"Test", cover:null, releaseYear:null, origin:null, language:null, genres:[], projectType:null, proposedBy:null, listenedBy:null, rating, shortReview:null, detailedReview:null, bestTrack:{title:null,url:null}, worstTrack:{title:null,url:null}, albumUrl:null, artistDescription:null, albumDescription:null, status:rating ? "rated" : "pending" });
test("les albums non notés sont exclus de la moyenne", () => assert.equal(getClubStats([album("A", 5), album("B", null)]).averageRating, 5));
test("les slugs normalisent accents et ponctuation", () => assert.equal(slugify("L’École du micro !"), "l-ecole-du-micro"));
test("le tri alphabétique est déterministe", () => assert.deepEqual(sortAlbums([album("Z", null), album("A", null)], "title").map(item => item.title), ["A", "Z"]));
test("les profils relient correctement les noms publics aux archives", () => {
  const entry = { ...album("Archive Toma", 4), proposedBy: "Toma", listenedBy: "Dod" };
  assert.equal(getMemberStats([entry], "toma").proposed.length, 1);
  assert.equal(getMemberStats([entry], "dod").listened.length, 1);
});

test("les styles les plus représentés sont normalisés et comptés une seule fois par album", () => {
  const styles = getRepresentedStyles([{ ...album("A", 4), genres: ["Rap", "Rap", "Soul"] }, { ...album("B", 3), genres: ["rap", "Jazz"] }, { ...album("C", null), genres: ["Soul"] }]);
  assert.deepEqual(styles, [{ name: "Rap", count: 2 }, { name: "Soul", count: 2 }, { name: "Jazz", count: 1 }]);
});
