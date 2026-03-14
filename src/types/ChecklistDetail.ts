import { SectionData } from "./SectionData";

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
