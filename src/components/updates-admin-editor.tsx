
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateCategories, type SiteUpdate, type UpdateCategory, type UpdateChange, type UpdateLink } from "@/data/site-updates";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type EditableUpdate = {
  id: string; version: string; date: string; title: string; summary: string;
  categories: UpdateCategory[]; added: string; fixed: string; improved: string; links: string;
};

function serializeChanges(changes: readonly UpdateChange[]) {
  return changes.map((item) => [item.text, item.href ?? "", item.linkLabel ?? ""].join(" | ")).join("\n");
}
function serializeLinks(links: readonly UpdateLink[]) {
  return links.map((item) => `${item.label} | ${item.href}`).join("\n");
}
function toEditable(update: SiteUpdate): EditableUpdate {
  return {
    id: update.id, version: update.version ?? "", date: update.date, title: update.title,
    summary: update.summary ?? "", categories: [...update.categories],
    added: serializeChanges(update.added), fixed: serializeChanges(update.fixed),
    improved: serializeChanges(update.improved), links: serializeLinks(update.links),
  };
}
function parseChanges(value: string): UpdateChange[] {
  return value.split("\n").flatMap((line) => {
    const [rawText, rawHref = "", rawLabel = ""] = line.split("|");
    const text = rawText?.trim();
    const href = rawHref.trim();
    const linkLabel = rawLabel.trim();
    if (!text) return [];
    if (!href.startsWith("/")) return [{ text }];
    return [{ text, href: href as `/${string}`, ...(linkLabel ? { linkLabel } : {}) }];
  });
}
function parseLinks(value: string): UpdateLink[] {
  return value.split("\n").flatMap((line) => {
    const [rawLabel, rawHref = ""] = line.split("|");
    const label = rawLabel?.trim();
    const href = rawHref.trim();
    return label && href.startsWith("/") ? [{ label, href: href as `/${string}` }] : [];
  });
}
function toUpdate(draft: EditableUpdate): SiteUpdate {
  return {
    id: draft.id, version: draft.version.trim() || undefined,
    date: draft.date as SiteUpdate["date"], title: draft.title.trim(),
    summary: draft.summary.trim() || undefined, categories: draft.categories,
    added: parseChanges(draft.added), fixed: parseChanges(draft.fixed),
    improved: parseChanges(draft.improved), links: parseLinks(draft.links),
  };
}

export function UpdatesAdminEditor({ updates }: { updates: readonly SiteUpdate[] }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<EditableUpdate[]>(() => updates.map(toEditable));
  const [knownIds, setKnownIds] = useState(() => updates.map((update) => update.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const loadAccess = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from("member_profiles").select("role").eq("id", auth.user.id).maybeSingle();
      if (active) setIsAdmin(data?.role === "admin");
    };
    void loadAccess();
    return () => { active = false; };
  }, [configured]);

  const updateDraft = <Key extends keyof EditableUpdate>(index: number, key: Key, value: EditableUpdate[Key]) => {
    setDrafts((current) => current.map((draft, draftIndex) =>
      draftIndex === index ? { ...draft, [key]: value } : draft,
    ));
  };
  const toggleCategory = (index: number, category: UpdateCategory) => {
    const current = drafts[index].categories;
    updateDraft(index, "categories", current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  };
  const addVersion = () => {
    const now = new Date();
    setDrafts((current) => [{
      id: `mise-a-jour-${now.getTime()}`, version: "", date: now.toISOString().slice(0, 10),
      title: "Nouvelle mise à jour", summary: "", categories: ["Nouvelle fonctionnalité"],
      added: "", fixed: "", improved: "", links: "",
    }, ...current]);
  };
  const removeVersion = (index: number) => {
    if (drafts.length < 2) { setMessage("Le journal doit conserver au moins une version."); return; }
    if (!window.confirm("Supprimer cette version du journal ?")) return;
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  };
  const cancel = () => {
    setDrafts(updates.map(toEditable));
    setEditing(false);
    setMessage("");
  };

  const save = async () => {
    if (!isAdmin || saving) return;
    const nextUpdates = drafts.map(toUpdate);
    if (nextUpdates.some((update) => !update.title || !/^\d{4}-\d{2}-\d{2}$/.test(update.date) || !update.categories.length)) {
      setMessage("Chaque version doit avoir un titre, une date et au moins une catégorie.");
      return;
    }
    setSaving(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    const rows = nextUpdates.map((update, displayOrder) => ({
      id: update.id, published_on: update.date, display_order: displayOrder,
      content: {
        version: update.version ?? "", title: update.title, summary: update.summary ?? "",
        categories: update.categories, added: update.added, fixed: update.fixed,
        improved: update.improved, links: update.links,
      },
    }));
    const { error } = await supabase.from("site_updates").upsert(rows, { onConflict: "id" });
    if (error) {
      setSaving(false);
      setMessage(`La sauvegarde a échoué : ${error.message}`);
      return;
    }
    const nextIds = nextUpdates.map((update) => update.id);
    const removedIds = knownIds.filter((id) => !nextIds.includes(id));
    if (removedIds.length) {
      const { error: deleteError } = await supabase.from("site_updates").delete().in("id", removedIds);
      if (deleteError) {
        setSaving(false);
        setMessage(`Une version supprimée n’a pas pu être retirée : ${deleteError.message}`);
        return;
      }
    }
    setKnownIds(nextIds);
    setSaving(false);
    setEditing(false);
    setMessage("Les mises à jour ont bien été enregistrées.");
    router.refresh();
  };

  if (!isAdmin) return null;

  return (
    <>
      <section className="updates-admin-toolbar" aria-label="Administration des mises à jour">
        <div><span>ADMINISTRATION</span><b>Le journal est entièrement modifiable.</b></div>
        <button className="button" type="button" onClick={() => { setEditing((current) => !current); setMessage(""); }}>
          {editing ? "Fermer l’éditeur" : "Modifier les mises à jour"}
        </button>
      </section>
      {message ? <p className="updates-admin-message" role="status">{message}</p> : null}
      {editing ? (
        <form className="updates-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <header>
            <div>
              <p className="eyebrow">MODE ÉDITION ADMIN</p>
              <h2>Modifier le journal.</h2>
              <p>Une ligne correspond à une entrée. Lien facultatif : texte | /page | libellé du lien.</p>
            </div>
            <button className="button" type="button" onClick={addVersion}>Ajouter une version</button>
          </header>
          <div className="updates-editor__list">
            {drafts.map((draft, index) => (
              <fieldset className="updates-editor__card" key={draft.id}>
                <legend>VERSION {draft.version || index + 1}</legend>
                <button className="updates-editor__remove" type="button" onClick={() => removeVersion(index)}>Supprimer</button>
                <div className="updates-editor__main-fields">
                  <label>Version<input value={draft.version} onChange={(event) => updateDraft(index, "version", event.target.value)} placeholder="1.9" /></label>
                  <label>Date<input type="date" value={draft.date} onChange={(event) => updateDraft(index, "date", event.target.value)} required /></label>
                  <label className="updates-editor__wide">Titre<input value={draft.title} onChange={(event) => updateDraft(index, "title", event.target.value)} maxLength={180} required /></label>
                  <label className="updates-editor__wide">Résumé<textarea value={draft.summary} onChange={(event) => updateDraft(index, "summary", event.target.value)} rows={3} maxLength={800} /></label>
                </div>
                <div className="updates-editor__categories">
                  <span>Catégories</span>
                  <div>{updateCategories.map((category) => (
                    <label key={category}><input type="checkbox" checked={draft.categories.includes(category)} onChange={() => toggleCategory(index, category)} />{category}</label>
                  ))}</div>
                </div>
                <div className="updates-editor__changes">
                  <label>✨ Nouveautés<textarea value={draft.added} onChange={(event) => updateDraft(index, "added", event.target.value)} rows={6} placeholder="Une nouveauté par ligne" /></label>
                  <label>🛠️ Corrections<textarea value={draft.fixed} onChange={(event) => updateDraft(index, "fixed", event.target.value)} rows={6} placeholder="Une correction par ligne" /></label>
                  <label>🚀 Améliorations<textarea value={draft.improved} onChange={(event) => updateDraft(index, "improved", event.target.value)} rows={6} placeholder="Une amélioration par ligne" /></label>
                </div>
                <label className="updates-editor__links">Liens associés<textarea value={draft.links} onChange={(event) => updateDraft(index, "links", event.target.value)} rows={3} placeholder="Libellé | /page" /></label>
              </fieldset>
            ))}
          </div>
          <footer className="updates-editor__actions">
            <button className="button" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer toutes les modifications"}</button>
            <button className="text-link" type="button" onClick={cancel} disabled={saving}>Annuler</button>
          </footer>
        </form>
      ) : null}
    </>
  );
}
