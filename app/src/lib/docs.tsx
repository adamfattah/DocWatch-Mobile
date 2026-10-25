import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import type { Doc } from "../types";

// One Firestore subscription shared by every tab and the detail screen.
const Ctx = createContext<Doc[] | null>(null);

export function DocsProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  useEffect(() => {
    const q = query(collection(db, "users", uid, "docs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Doc, "id">) }))), (e) => console.warn("docs listener", e.code));
  }, [uid]);
  return <Ctx.Provider value={docs}>{children}</Ctx.Provider>;
}

/** null while the first snapshot is loading. */
export const useDocs = () => useContext(Ctx);
