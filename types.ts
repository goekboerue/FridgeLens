export interface Ingredient {
  name: string;
  category?: string;
  expiryDate?: string; // YYYY-MM-DD format
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  usedIngredients: string[];
  missingIngredients: string[];
  instructions: string[];
  prepTime: string;
  difficulty: 'Kolay' | 'Orta' | 'Zor';
  calories?: number;
}

export enum AppState {
  HOME = 'HOME',
  CAMERA = 'CAMERA',
  ANALYZING = 'ANALYZING',
  INGREDIENTS = 'INGREDIENTS',
  GENERATING_RECIPES = 'GENERATING_RECIPES',
  RECIPES = 'RECIPES',
}

export interface MarketStore {
  name: string;
  distance: string;
  deliveryTime: string;
  price: string;
}

export const DIETARY_OPTIONS = [
  'Hepsi',
  'Vejetaryen',
  'Vegan',
  'Glutensiz',
  'Düşük Karbonhidrat',
  'Yüksek Protein'
];