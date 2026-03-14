"use client";

import React, { useState } from "react";
import ChecklistList from "./ChecklistList";
import ChecklistDetail from "./ChecklistDetail";
import styles from "./App.module.css";

type Page =
  | { view: "list" }
  | { view: "detail"; checklistId: string };

export default function App() {
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
