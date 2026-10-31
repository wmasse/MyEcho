import { ImageResponse } from "next/og";
import EchoSocialCard from "@/components/EchoSocialCard";

export const alt = "Echo logo on a dark green background";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<EchoSocialCard />, size);
}
