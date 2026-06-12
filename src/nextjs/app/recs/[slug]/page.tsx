"use client";

import { Rec } from "@/types/definitions";
import { use, useRef, useState, useEffect } from "react";

interface Segment {
  type: "music" | "speech" | "noise" | "noEnergy";
  start: number;
  end: number;
}

interface GroupedSegment {
  type: "music" | "other";
  start: number;
  end: number;
}

export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mockData, setMockData] = useState<Rec | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    fetch("/mock/20260510main.json")
      .then((res) => res.json())
      .then((data) => setMockData(data))
      .catch((err) => console.error("Failed to load mock data:", err));
  }, []);

  const groupedSegments: GroupedSegment[] = [];
  if (mockData) {
    mockData.segments.forEach((segment) => {
      const currentType = segment.type === "music" ? "music" : "other";
      const lastGroup = groupedSegments[groupedSegments.length - 1];

      if (lastGroup && lastGroup.type === currentType) {
        lastGroup.end = segment.end;
      } else {
        groupedSegments.push({
          type: currentType,
          start: segment.start,
          end: segment.end,
        });
      }
    });
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    }
  };

  const handleSkipTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(
          audioRef.current.duration || 0,
          audioRef.current.currentTime + seconds,
        ),
      );
    }
  };

  const getCurrentGroupIndex = () => {
    return groupedSegments.findIndex(
      (group) => currentTime >= group.start && currentTime < group.end,
    );
  };

  const handleSkipBlock = (direction: "prev" | "next") => {
    if (!audioRef.current || groupedSegments.length === 0) return;
    const currentIndex = getCurrentGroupIndex();

    let targetIndex = currentIndex;
    if (direction === "prev") {
      if (
        currentIndex > 0 &&
        currentTime - groupedSegments[currentIndex].start < 2
      ) {
        targetIndex = currentIndex - 1;
      } else if (currentIndex !== -1) {
        targetIndex = currentIndex;
      }
    } else {
      if (currentIndex !== -1 && currentIndex < groupedSegments.length - 1) {
        targetIndex = currentIndex + 1;
      }
    }

    if (groupedSegments[targetIndex]) {
      audioRef.current.currentTime = groupedSegments[targetIndex].start;
    }
  };

  const handleJump = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  if (!mockData) {
    return <p>Loading rehearsal data...</p>;
  }

  const currentGroupIndex = getCurrentGroupIndex();

  return (
    <main
      style={{
        paddingBottom: "8rem",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <header>
        <h1>Segnote</h1>
        <p>
          Recording ID: <strong>{slug}</strong>
        </p>
      </header>

      <nav
        style={{
          position: "sticky",
          top: 0,
          background: "var(--background)",
          color: "var(--foreground)",
          padding: "1rem 0",
          borderBottom: "2px solid var(--foreground)",
          zIndex: 100,
        }}
      >
        <h2>Controller</h2>
        <menu
          style={{
            display: "flex",
            gap: "0.5rem",
            listStyle: "none",
            padding: 0,
            margin: "0 0 1rem 0",
          }}
        >
          <li>
            <button
              type="button"
              onClick={() => handleSkipBlock("prev")}
              style={{
                background: "transparent",
                color: "var(--foreground)",
                border: "1px solid var(--foreground)",
              }}
            >
              ⏮ Prev Block
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => handleSkipTime(-10)}
              style={{
                background: "transparent",
                color: "var(--foreground)",
                border: "1px solid var(--foreground)",
              }}
            >
              -10s
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handlePlayPause}
              style={{
                fontWeight: "bold",
                background: "var(--foreground)",
                color: "var(--background)",
                border: "1px solid var(--foreground)",
              }}
            >
              {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => handleSkipTime(10)}
              style={{
                background: "transparent",
                color: "var(--foreground)",
                border: "1px solid var(--foreground)",
              }}
            >
              +10s
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => handleSkipBlock("next")}
              style={{
                background: "transparent",
                color: "var(--foreground)",
                border: "1px solid var(--foreground)",
              }}
            >
              Next Block ⏭
            </button>
          </li>
        </menu>

        <audio
          ref={audioRef}
          src="/mock/audio/20260510main.mp3"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls
          style={{ width: "100%", maxWidth: "600px" }}
        />

        <p>
          Current State:{" "}
          <strong>
            {currentGroupIndex !== -1
              ? groupedSegments[currentGroupIndex].type === "music"
                ? "Music"
                : "Other"
              : "Unknown"}
          </strong>
        </p>
      </nav>

      <hr style={{ borderColor: "var(--foreground)" }} />

      <section>
        <h2>Timeline Blocks</h2>
        <ol>
          {groupedSegments.map((group, index) => {
            const formatTime = (time: number) => {
              const mins = Math.floor(time / 60);
              const secs = Math.floor(time % 60)
                .toString()
                .padStart(2, "0");
              return `${mins}:${secs}`;
            };

            const isCurrent = index === currentGroupIndex;

            return (
              <li key={index} style={{ marginBottom: "1.5rem" }}>
                <article
                  style={{
                    border: isCurrent
                      ? "2px solid var(--foreground)"
                      : "1px solid var(--foreground)",
                    padding: "1rem",
                    opacity: isCurrent ? 1 : 0.7,
                  }}
                >
                  <h3>
                    {isCurrent && "▶ "}
                    {group.type === "music" ? "Music Section" : "Other Section"}
                  </h3>
                  <p>
                    <time>{formatTime(group.start)}</time> -{" "}
                    <time>{formatTime(group.end)}</time> (
                    {(group.end - group.start).toFixed(1)}s)
                  </p>
                  <button
                    type="button"
                    onClick={() => handleJump(group.start)}
                    style={{
                      background: "transparent",
                      color: "var(--foreground)",
                      border: "1px solid var(--foreground)",
                    }}
                  >
                    ▶ Jump to Block
                  </button>
                </article>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
