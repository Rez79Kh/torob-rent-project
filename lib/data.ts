import dataset from "@/data/listings.json";
import type { Dataset, RawListing } from "./types";

export type ClientData = Omit<Dataset, "raw">;

const DATA = dataset as unknown as Dataset;
const RAW_BY_ID = new Map<string, RawListing>(DATA.raw.map((r) => [r.id, r]));

export function clientData(): ClientData {
  const { raw: _raw, ...rest } = DATA;
  void _raw;
  return rest;
}

export function rawById(id: string): RawListing | undefined {
  return RAW_BY_ID.get(id);
}
