import { ItemData } from "./ItemData";

export interface SectionData {
  id: string;
  name: string;
  order: number;
  items: ItemData[];
}
