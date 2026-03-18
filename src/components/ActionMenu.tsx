"use client";

import React from "react";
import { ButtonMenu } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";

export interface MenuAction {
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
  variant?: "danger" | "info";
}

export default function ActionMenu({ actions }: { actions: MenuAction[] }) {
  return (
    <div className={styles.actionMenuWrapper}>
      <ButtonMenu
        trigger={<span className={styles.actionMenuTrigger}>⋮</span>}
        options={actions.map((a) => ({
          label: a.label,
          icon: a.icon,
          onClick: a.onClick,
          variant: a.variant,
        }))}
        alignment="right"
      />
    </div>
  );
}
