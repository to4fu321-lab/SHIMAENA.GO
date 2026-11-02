import type { Metadata } from "next";
import MapScreen from "@/components/MapScreen";
import { DEMO_MORNING } from "@/lib/demo-morning";

export const metadata: Metadata = { title: "地図 ・ シマエナGO" };

export default function MapPage() {
  return <MapScreen state={DEMO_MORNING} />;
}
