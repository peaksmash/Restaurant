export interface CartaCategory {
  id: string;
  name: string;
  enabled?: boolean;
  products: CartaProduct[];
}

export interface CartaProduct {
  id: string;
  name: string;
  price: number;
  enabled?: boolean;
  type?: 'PRODUCT' | 'COMBO';
  externalId?: string;
  modifierGroups?: string[];
  imageUrl?: string;
  allergens?: string[];
  displayPrice?: number;
  promotion?: {
    id: string;
    name?: string;
    discountType?: string;
    discountAmount?: number;
    label?: string;
  };
  description?: string;
}

export const MOCK_CARTA_CATEGORIES: CartaCategory[] = [
  {
    id: 'burgers',
    name: 'Burgers',
    products: [
      { id: 'b1', name: 'Classic Burger', price: 1290, description: 'Carne, queso y salsa clásica' },
      { id: 'b2', name: 'Double Smash', price: 1590, description: 'Doble carne y cheddar' },
      { id: 'b3', name: 'Chicken Crispy', price: 1390, description: 'Pollo crujiente y mayo' },
    ],
  },
  {
    id: 'combos',
    name: 'Combos',
    products: [
      { id: 'c1', name: 'Combo Classic', price: 1590, description: 'Burger, fries y bebida' },
      { id: 'c2', name: 'Combo Smash', price: 1890, description: 'Double Smash, fries y bebida' },
    ],
  },
  {
    id: 'sides',
    name: 'Sides',
    products: [
      { id: 's1', name: 'Fries', price: 390, description: 'Patatas fritas' },
      { id: 's2', name: 'Nuggets', price: 490, description: '6 unidades' },
    ],
  },
  {
    id: 'drinks',
    name: 'Drinks',
    products: [
      { id: 'd1', name: 'Cola', price: 280 },
      { id: 'd2', name: 'Zero Cola', price: 280 },
      { id: 'd3', name: 'Water', price: 220 },
    ],
  },
];
