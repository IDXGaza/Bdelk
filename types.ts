
export interface Alternative {
  name: string;
  origin: string;
  manufacturer: string;
  description: string;
  imageUrl?: string;
  detailedBenefits?: string;
  certificates?: string[];
  priceRange?: string; 
  availabilityLocations?: string[];
  websiteUrl?: string; // New: Official website or product page
  mapsUrl?: string;    // New: Google Maps link if it's a physical place
}

export interface ProductInfo {
  name: string;
  brand: string;
  category: string;
  isBoycotted: boolean;
  reason: string;
  imageUrl?: string;
  alternatives: Alternative[];
  parentCompany?: string;
  originCountry?: string;
  detailedImpact?: string;
  availabilityLocations?: string[];
}

export interface BoycottNews {
  hasSignificantChanges: boolean;
  summary: string;
  recentAdditions: string[];
  lastUpdatedDate: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  SEARCHING = 'SEARCHING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
  NEWS = 'NEWS',
  FAVORITES = 'FAVORITES',
  ADD_PRODUCT = 'ADD_PRODUCT'
}
