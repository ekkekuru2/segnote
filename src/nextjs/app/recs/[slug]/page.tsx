"use client";

import {
  NextSegmentButton,
  PlayButton,
  PreviousSegmentButton,
} from "@/app/ui/player/buttons";
import Slider from "@/app/ui/player/slider";
import { recs } from "@/public/mock/mockdata";

import { useState } from "react";

export default function RecPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // const { slug } = await params;
  const [currentTime, setCurrentTime] = useState(0);
  const rec = recs[0]; // TODO: find by slug

  return (
    <div>
      <p>this is a player.</p>
      <Slider
        segments={rec.segments}
        value={currentTime}
        onChange={setCurrentTime}
        snapThreshold={5}
      />
      <PreviousSegmentButton />
      <PlayButton />
      <NextSegmentButton />
    </div>
  );
}
