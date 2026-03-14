export interface ItemRecord {
  sectionId: string;
  checklistId: string;
  title: string;
  assigneeId: string;
  dueDate: string;
  reusable: boolean;
  complete: boolean;
  order: number;
}
