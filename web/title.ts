import { useEffect } from "react";

/** Replaces Next's per-page `metadata` export. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Vertex OS`;
  }, [title]);
}
