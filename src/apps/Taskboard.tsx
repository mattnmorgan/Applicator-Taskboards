"use client";

import React from "react";
import ChecklistList from "@/src/components/ChecklistList";
import ChecklistDetail from "@/src/components/ChecklistDetail";
import styles from "./Taskboard.module.css";

interface Props {
  path?: string[];
  appId?: string;
  navigate?: (url: string) => void;
}

const APP_BASE = "/app/tasklist:main";

export default function Taskboard({ path, navigate: navProp }: Props) {
  const nav = (url: string) => navProp?.(url);

  const checklistId = path?.[0] === "checklist" && path?.[1] ? path[1] : null;

  return (
    <div className={styles.app}>
      {!checklistId && (
        <ChecklistList
          onOpen={(id) => nav(`${APP_BASE}/checklist/${id}`)}
        />
      )}
      {checklistId && (
        <ChecklistDetail
          checklistId={checklistId}
          onBack={() => nav(APP_BASE)}
        />
      )}
    </div>
  );
}
