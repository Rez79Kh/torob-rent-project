export type Source = "divar" | "sheypoor" | "kilid";
export type Toman = number;

export interface RawListing {
  id: string;
  source: Source;
  url: string;
  token?: string;
  title: string;
  description: string;
  priceText: { deposit?: string; rent?: string };
  formFields: Record<string, string>;
  badges: string[];
  convertibleFlag?: boolean;
  advertiser: { kind: "agency" | "owner"; name?: string; activeAds?: number };
  neighborhoodText: string;
  approxLocation?: { lat: number; lng: number; radiusM: number };
  imageHashes?: string[];
  postedAt: string;
  fetchedAt: string;
  isSeed: boolean;
}

export interface Convertibility {
  mode: "none" | "form" | "text";
  minDeposit: Toman;
  maxDeposit: Toman;
  rate: number;
  evidence?: string;
}

export type RedFlagCode =
  | "family_only"
  | "couple_only"
  | "no_single"
  | "shared_parking"
  | "mozahem_parking"
  | "evict_end_of_month"
  | "decorative_photos"
  | "placeholder_price"
  | "non_apartment"
  | "commission_extra"
  | "short_contract"
  | "basement_unit"
  | "no_elevator_high_floor";

export type AmenityKey = "parking" | "elevator" | "storage" | "balcony" | "renovated";
export type Amenities = Record<AmenityKey, boolean>;

export interface RedFlag {
  code: RedFlagCode;
  evidence: string;
}

export interface NormalizedListing {
  id: string;
  rawId: string;
  source: Source;
  url: string;
  title: string;
  neighborhood: string;
  areaM2: number;
  rooms: number;
  floor?: number;
  totalFloors?: number;
  buildYear?: number;
  deposit: Toman;
  rent: Toman;
  convert: Convertibility;
  amenities: Amenities;
  realPhotos: "yes" | "decorative" | "unknown";
  redFlags: RedFlag[];
  advertiser: RawListing["advertiser"];
  geo: { lat: number; lng: number; approx: boolean };
  nearestMetro?: { name: string; distanceM: number };
  textVector?: number[];
  imageHashes?: string[];
  isSeed: boolean;
  postedAt: string;
  extraction: {
    method: "llm" | "rules";
    model?: string;
    confidence: number;
    fieldsFromText: string[];
  };
}

export interface ClusterMember {
  listingId: string;
  similarity: number;
  matchedOn: string[];
  evidence?: { textCosine: number; imageOverlap: number | null; pairedWith: string };
}

export interface PropertyCluster {
  clusterId: string;
  canonicalId: string;
  memberIds: string[];
  members: ClusterMember[];
  priceSpread: { minEffective: Toman; maxEffective: Toman; savings: Toman };
  bestMemberId: string;
}

export interface NeighborhoodStats {
  slug: string;
  medianEffPerM2: Toman;
  p25: Toman;
  p75: Toman;
  n: number;
}

export interface Dataset {
  generatedAt: string;
  conversionRate: number;
  listings: NormalizedListing[];
  raw: RawListing[];
  clusters: PropertyCluster[];
  neighborhoods: NeighborhoodStats[];
  stats: { rawCount: number; droppedNoise: number; mergedDuplicates: number; textOnlyConvertible: number };
}

export type MustKey = AmenityKey | "near_metro";
export type Household = "single" | "couple" | "family";

export interface Weights {
  cost: number;
  fairness: number;
  fit: number;
  trust: number;
  commute: number;
}

export interface UserIntent {
  cash: Toman;
  maxRent: Toman;
  userRate: number;
  neighborhoods: string[];
  minArea?: number;
  minRooms?: number;
  maxBuildAge?: number;
  must: MustKey[];
  nice: MustKey[];
  household?: Household;
  weights: Weights;
  parsedBy: "llm" | "rules" | "manual";
  rawQuery: string;
}

export interface RankedResult {
  cluster: PropertyCluster;
  listing: NormalizedListing;
  feasible: boolean;
  chosenDeposit: Toman;
  resultingRent: Toman;
  effectiveMonthly: Toman;
  effPerM2: Toman;
  fairDeltaPct: number;
  score: number;
  scoreBreakdown: Weights;
  unlockedByConversion: boolean;
  blockingFlags: RedFlagCode[];
  rejectReason?: string;
}

export interface Explanation {
  bullets: { vs: number; text: string }[];
  by: "llm" | "template";
}
