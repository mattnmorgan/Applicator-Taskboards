export interface ChecklistSummary {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  role: "owner" | "editor" | "viewer";
  ownerName: string;
  shareId?: string;
}
