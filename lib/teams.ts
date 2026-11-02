import teamsJson from "@/data/teams.json";
import type { Team, TeamId } from "./types";

export const TEAMS = teamsJson as Team[];

export function getTeam(id: TeamId): Team {
  const team = TEAMS.find((t) => t.id === id);
  if (!team) throw new Error(`チームが見つかりません: ${id}`);
  return team;
}
