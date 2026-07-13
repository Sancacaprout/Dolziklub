"""Build the application's album archive from the club's source folders.

Usage (from the repository root):
  python scripts/refresh_album_archive.py "C:\\DOL ZIKLUB\\DOL_ZIKLUB info albums"

The source workbook is preserved as the original record. The Markdown sheets in
the supplied directory are its normalized, per-album version and are converted
to a small JSON file that can safely be bundled by Next.js.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "albums.generated.json"
MANIFEST = ROOT / "src" / "data" / "manifest_pochettes.json"

# The source files use a few harmless spelling/case variants. Keep the aliases
# here so a missing visual is visible and intentional rather than guessed.
COVER_ALIASES = {
    ("submarine", "the marias"): ("submarine", "the marias"),
    ("2005 & play!", "south arcade"): ("2005", "south arcade"),
    ("the great chinggis khan", "batzorig vaanching"): ("the great chinggis khan", "batzorig vaanchig"),
    ("this is how tomorrow moves", "beabadoobe"): ("this is how tomorrow moves", "beabadoobee"),
}


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", value.lower())


def line_value(markdown: str, label: str) -> str | None:
    match = re.search(rf"^- \*\*{re.escape(label)}\s*:\*\*\s*(.+)$", markdown, re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip()
    return None if value in {"Non vérifié", "Non renseigné", "Non noté"} else value


def section(markdown: str, number: int) -> str:
    match = re.search(rf"^## {number}\. .*?\n(.*?)(?=^## \d+\. |\Z)", markdown, re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else ""


def first_paragraph(value: str) -> str | None:
    # Excel exports threaded comments with a long informational preamble. It
    # is not part of the club member's review and must never reach the site.
    value = re.sub(r"^\[Threaded comment\].*?Comment:\s*", "", value, flags=re.DOTALL)
    cleaned = re.sub(r"\n+", " ", value).strip()
    return None if not cleaned or cleaned.startswith("Aucun ") else cleaned


def review(markdown: str, heading: str) -> str | None:
    match = re.search(
        rf"^### {re.escape(heading)}.*?\n\n(.*?)(?=\n\n### |\n## |\Z)",
        markdown,
        re.MULTILINE | re.DOTALL,
    )
    return first_paragraph(match.group(1)) if match else None


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Provide the path to the DOL_ZIKLUB info albums directory.")

    source = Path(sys.argv[1])
    index = json.loads((source / "index_albums.json").read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    covers = {
        (normalized(item["album"]), normalized(item["artiste"])): f"/covers/{item['fichier']}"
        for item in manifest
    }

    source_items = []
    for item in index:
        # The workbook records these two South Arcade releases as one listening
        # session, while the supplied archive deliberately keeps a sheet and a
        # cover for each release. Preserve both catalogue entries with their
        # shared club verdict.
        if item["dossier"] == "2005 & PLAY! - South Arcade":
            for title in ("2005", "PLAY!"):
                source_items.append({**item, "album": title, "dossier": f"{title} - South Arcade", "fiche": f"{title} - South Arcade.md"})
        else:
            source_items.append(item)

    records = []
    missing_covers = []
    for position, item in enumerate(source_items, start=1):
        markdown = (source / item["dossier"] / item["fiche"]).read_text(encoding="utf-8")
        key = (normalized(item["album"]), normalized(item["artiste"]))
        alias_key = COVER_ALIASES.get((item["album"].lower(), item["artiste"].lower()))
        if alias_key:
            key = (normalized(alias_key[0]), normalized(alias_key[1]))
        cover = covers.get(key)
        if not cover:
            missing_covers.append(f"{item['album']} — {item['artiste']}")

        rating_text = item["note"]
        rating = int(rating_text.split("/")[0]) if re.fullmatch(r"[0-5]/5", rating_text) else None
        year_text = line_value(markdown, "Année de sortie")
        records.append(
            {
                "position": position,
                "title": item["album"],
                "artist": item["artiste"],
                "cover": cover,
                "releaseYear": int(year_text) if year_text and year_text.isdigit() else None,
                "origin": line_value(markdown, "Origine de l’artiste"),
                "language": line_value(markdown, "Langue principale"),
                "genres": [genre.strip() for genre in (line_value(markdown, "Genres dominants") or "").split(",") if genre.strip()],
                "projectType": line_value(markdown, "Type de projet"),
                "proposedBy": item["propose_par"],
                "listenedBy": item["ecoute_par"],
                "rating": rating,
                "shortReview": review(markdown, "Avis synthétique"),
                "detailedReview": review(markdown, "Commentaire détaillé"),
                "bestTrack": {"title": line_value(markdown, "Meilleur morceau choisi"), "url": None},
                "worstTrack": {"title": line_value(markdown, "Pire morceau choisi"), "url": None},
                "albumUrl": None,
                "artistDescription": first_paragraph(section(markdown, 2)),
                "albumDescription": first_paragraph(section(markdown, 3)),
                "status": "rated" if rating is not None else "pending",
            }
        )

    if missing_covers:
        raise SystemExit("Missing cover mappings: " + "; ".join(missing_covers))

    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} albums to {OUTPUT}")


if __name__ == "__main__":
    main()
