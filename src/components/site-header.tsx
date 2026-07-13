"use client";
import Link from "next/link";
import { useState } from "react";

const links = [["Albums", "/albums"], ["Membres", "/membres"], ["Classements", "/classements"], ["Mêmes", "/memes"], ["Le concept", "/concept"]] as const;
const clubSheetUrl = "https://docs.google.com/spreadsheets/d/1xdhbz6kRsdhEsdQIuZ7TbRbJ_umvfacopPLpYFRqrRI/edit?usp=sharing";
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><Link href="/" className="logo" onClick={() => setOpen(false)}>DOL <i>ZIKLUB</i></Link><button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-nav">Menu</button><nav id="main-nav" className={open ? "open" : ""}>{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<a href={clubSheetUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Tableur ↗</a><Link className="random-link" href="/hasard" onClick={() => setOpen(false)}>Album au hasard ↗</Link></nav></header>;
}
