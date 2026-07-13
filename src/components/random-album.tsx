"use client";
import { useState } from "react";
import Link from "next/link";
import { AlbumCard } from "@/components/album-card";
import type { Album } from "@/types/album";
export function RandomAlbum({ albums }: { albums: Album[] }) { const [index, setIndex] = useState(() => Math.floor(Math.random() * albums.length)); const album = albums[index]; return <div className="random-box"><p className="eyebrow">LE BAC A DÉCIDÉ</p><AlbumCard album={album} compact /><div><button className="button" onClick={() => setIndex(Math.floor(Math.random() * albums.length))}>Un autre album</button><Link className="text-link" href={`/albums/${album.slug}`}>Voir la fiche →</Link></div></div>; }
