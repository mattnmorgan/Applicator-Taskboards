export interface ChecklistSummary {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  role: "owner" | "editor" | "viewer";
}

export interface ItemData {
  id: string;
  sectionId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  reusable: boolean;
  complete: boolean;
  order: number;
  subscribed: boolean;
  subscriptionId: string | null;
}

export interface SectionData {
  id: string;
  name: string;
  order: number;
  items: ItemData[];
}

export interface ChecklistDetail {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  currentUserId: string;
  access: "owner" | "editor" | "viewer";
  subscribed: boolean;
  subscriptionId: string | null;
  sections: SectionData[];
}

export interface SystemUser {
  id: string;
  username: string;
  displayName: string;
}
