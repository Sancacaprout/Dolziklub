"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "./admin.module.css";

type Member = { username: string; name: string; role: string; avatarUrl: string | null };
type Sort = "name" | "username";
const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.slice(0, 1)).join("").toLocaleUpperCase("fr") || "?";
}

export function AdminMemberList({ members }: { members: Member[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const visible = useMemo(() => {
    const query = normalize(search.trim().replace(/^@/, ""));
    return members
      .filter((member) => normalize(member.name).includes(query) || normalize(member.username).includes(query))
      .sort((first, second) => collator.compare(first[sort], second[sort]) || collator.compare(first.username, second.username));
  }, [members, search, sort]);

  return <>
    {members.length ? <div className={styles.filters}>
      <label>Rechercher un membre
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou pseudo" />
      </label>
      <label>Trier par
        <select value={sort} onChange={(event) => setSort(event.target.value === "username" ? "username" : "name")}>
          <option value="name">Nom</option>
          <option value="username">Pseudo</option>
        </select>
      </label>
    </div> : null}
    {visible.length ? <ul className={styles.list} aria-label="Membres du club">
      {visible.map((member) => <li key={member.username} className={styles.member}>
        {member.avatarUrl ? <Image unoptimized src={member.avatarUrl} alt="" className={styles.avatar} width={44} height={44} /> : <span className={styles.avatar} aria-hidden="true">{initials(member.name)}</span>}
        <div className={styles.identity}><strong>{member.name}</strong><span>@{member.username}</span></div>
        <span className={styles.role}>{member.role === "admin" ? "Administrateur" : "Membre"}</span>
        <button className={styles.assist} type="button" disabled aria-describedby="member-assistance-status" aria-label={`Assister le compte de ${member.name}`}>Assister ce compte</button>
      </li>)}
    </ul> : <p role="status">{members.length ? "Aucun membre ne correspond à la recherche." : "Aucun membre dans le répertoire."}</p>}
  </>;
}
