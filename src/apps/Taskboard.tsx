"use client";

import React, { useState, useEffect } from "react";
import ChecklistList from "@/src/components/ChecklistList";
import ChecklistDetail from "@/src/components/ChecklistDetail";
import styles from "./Taskboard.module.css";

type Page =
  | { view: "list" }
  | { view: "detail"; checklistId: string };

interface Props {
  path?: string[];
  appId?: string;
}

const APP_BASE = "/app/tasklist:main";

function pageFromSegments(segments: string[]): Page {
  if (segments[0] === "checklist" && segments[1]) {
    return { view: "detail", checklistId: segments[1] };
  }
  return { view: "list" };
}

function urlForPage(page: Page): string {
  if (page.view === "detail") return `${APP_BASE}/checklist/${page.checklistId}`;
  return APP_BASE;
}

export default function Taskboard({ path }: Props) {
  // path prop is only set on initial mount — the framework does not update it
  // on pushState, so we own state from here on.
  const [page, setPage] = useState<Page>(() => pageFromSegments(path ?? []));

  // Handle browser back/forward — pushState does NOT fire popstate, so this
  // only triggers on genuine browser navigation, no infinite loop risk.
  useEffect(() => {
    const onPopState = () => {
      const segments = window.location.pathname
        .replace(APP_BASE, "")
        .split("/")
        .filter(Boolean);
      setPage(pageFromSegments(segments));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (next: Page) => {
    setPage(next);
    window.history.pushState(null, "", urlForPage(next));
  };

  return (
    <div className={styles.app}>
      {page.view === "list" && (
        <ChecklistList
          onOpen={(id) => navigate({ view: "detail", checklistId: id })}
        />
      )}
      {page.view === "detail" && (
        <ChecklistDetail
          checklistId={page.checklistId}
          onBack={() => navigate({ view: "list" })}
        />
      )}
    </div>
  );
}
