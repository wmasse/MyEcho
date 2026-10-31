"use client";

import { useParams } from "next/navigation";
import SharedEchoView from "@/components/SharedEchoView";

export default function SharedEchoById() {
  const { id } = useParams<{ id: string }>();

  return <SharedEchoView shareId={id} />;
}
