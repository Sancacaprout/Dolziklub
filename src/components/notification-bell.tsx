"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Notification = {
  id: string;
  kind: "meme" | "album" | "review" | "draw" | "task" | "comment";
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

const icons = { meme: "✦", album: "♫", review: "✎", draw: "◎", task: "!", comment: "#" } as const;

function formatDate(date: string) {
  const difference = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(date));
}

export function NotificationBell() {
  const configured = isSupabaseConfigured();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabaseBrowserClient()
      .from("member_notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as Notification[]);
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabaseBrowserClient();
    const syncMember = async () => {
      const { data } = await supabase.auth.getUser();
      setMemberId(data.user?.id ?? null);
      if (data.user) await loadNotifications();
      else setNotifications([]);
    };
    void syncMember();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => void syncMember());
    const channel = supabase.channel("member-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_notifications" }, () => void loadNotifications())
      .subscribe();
    return () => {
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [configured, loadNotifications]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const markRead = useCallback(async () => {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (!unreadIds.length || !configured) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification));
    await getSupabaseBrowserClient().from("member_notifications").update({ read_at: readAt }).in("id", unreadIds);
  }, [configured, notifications]);

  const toggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) void markRead();
  };

  const remove = async (id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
    if (configured) await getSupabaseBrowserClient().from("member_notifications").delete().eq("id", id);
  };

  const clear = async () => {
    setNotifications([]);
    if (configured && memberId) await getSupabaseBrowserClient().from("member_notifications").delete().eq("recipient_id", memberId);
  };

  if (!configured || !memberId) return null;
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return <aside className="notification-bell" ref={panelRef} aria-label="Notifications">
    <button className="notification-bell__trigger" type="button" onClick={toggle} aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : ""}`} aria-expanded={open}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unreadCount > 0 && <span className="notification-bell__count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
    {open && <div className="notification-bell__panel" role="dialog" aria-label="Boîte de notifications">
      <header><div><span>BOÎTE DU KLUB</span><h2>Notifications</h2></div>{notifications.length > 0 && <button className="notification-bell__clear" type="button" onClick={() => void clear()} title="Vider la corbeille">Vider</button>}</header>
      {notifications.length === 0 ? <div className="notification-bell__empty"><b>Rien de nouveau.</b><span>Ta boîte est parfaitement calme.</span></div> : <ul>{notifications.map((notification) => <li key={notification.id} className={notification.read_at ? "" : "is-unread"}><Link href={notification.href} onClick={() => setOpen(false)}><i aria-hidden="true">{icons[notification.kind]}</i><span><b>{notification.title}</b><small>{notification.body}</small><time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time></span></Link><button type="button" onClick={() => void remove(notification.id)} aria-label={`Supprimer : ${notification.title}`} title="Supprimer">×</button></li>)}</ul>}
    </div>}
  </aside>;
}
