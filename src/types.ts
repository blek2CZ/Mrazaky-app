export interface Item {
  id: string;
  name: string;
  quantity: number;
}

export interface DrawerContent {
  [drawerId: number]: Item[];
}

export interface FreezerData {
  small: DrawerContent;
  large: DrawerContent;
  smallMama: DrawerContent;
  cellar: DrawerContent;
}

export interface ItemTemplate {
  id: string;
  name: string;
}
