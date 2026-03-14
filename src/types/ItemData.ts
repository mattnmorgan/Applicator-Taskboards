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
