"use client";

import React, { useState } from "react";
import ChecklistList from "../components/ChecklistList";
import ChecklistDetail from "../components/ChecklistDetail";
import styles from "./Taskboard.module.css";

type Page =
  | { view: "list" }
  | { view: "detail"; checklistId: string };

export default function Taskboard() {
  const [page, setPage] = useState<Page>({ view: "list" });

  return (
    <div className={styles.app}>
      {page.view === "list" && (
        <ChecklistList
          onOpen={(id) => setPage({ view: "detail", checklistId: id })}
        />
      )}
      {page.view === "detail" && (
        <ChecklistDetail
          checklistId={page.checklistId}
          onBack={() => setPage({ view: "list" })}
        />
      )}
    </div>
  );
}
