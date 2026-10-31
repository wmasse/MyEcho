import type { Metadata } from "next";
import StatsDashboard from "./stats-dashboard";

export const metadata: Metadata = {
  title: "Listening Stats | Echo",
  description: "Explore your Spotify listening patterns with Echo.",
};

export default function StatsPage() {
  return <StatsDashboard />;
}
