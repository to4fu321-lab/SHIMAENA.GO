import townJson from "@/data/town.json";
import type { Base, Building, LatLng, Participant } from "./types";

/** デモ用の架空のエリア（建物の形は OpenStreetMap、人物とエリア名は架空） */
export interface Town {
  name: string;
  attribution: string;
  center: LatLng;
  radiusM: number;
  buildings: Building[];
  parks: { id: string; polygon: LatLng[] }[];
  bases: Base[];
  participants: Participant[];
}

export const TOWN = townJson as unknown as Town;

export function getBuilding(id: string): Building | undefined {
  return TOWN.buildings.find((b) => b.id === id);
}

export function getParticipant(id: string): Participant | undefined {
  return TOWN.participants.find((p) => p.id === id);
}
