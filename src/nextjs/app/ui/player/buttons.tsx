export function PlayButton() {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.633 7.633v8.734a2.25 2.25 0 001.152 1.940l.001.002a2.251 2.251 0 002.152-.026A11.969 11.969 0 0112 4.969c5.523 0 10.000 4.477 10.000 10.000zM14.752 11.168l-3.197-2.132A1.125 1.125 0 0010 9.875v4.263c0 .621.564 1.102 1.555.832l3.197-2.132a1.125 1.125 0 000-1.664z"
        />
      </svg>
    </button>
  );
}

export function NextSegmentButton() {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.59 14.37a6 6 0 01-2.58 3.74m0 0L15 21m-2.41-3.63a6 6 0 00-2.58-3.74m0 0L9 21m11.54-9h-.01M     12 5.879V5.88m0 0a3 3 0 110 6 3 3 0 010-6z"
        />
      </svg>
    </button>
  );
}

export function PreviousSegmentButton() {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.633 10.5c.806 0 1.533-.446 1.933-1.08a1.498 1.498 0 012.54 0c.4.634 1.127 1.08 1.933 1.08M14.5 21h-4.873a4.992 4.992 0 01-4.694-3.667M16.633 10.5c-.806 0-1.533-.446-1.933-1.08a1.498 1.498 0 012.54 0c.4.634 1.127 1.08 1.933 1.08M5.21 6.633A4.993 4.993 0 0112 3c1.152 0 2.243.26 3.21.693M6.633 10.5a4.978 4.978 0 00-2.577-.698A4.993 4.993 0 003c1.152 0 2.243.26 3.21.693m7.157-.693a4.982 4.982 0 012.577-.698A4.993 4.993 0 0112 3c-1.152 0-2.243.26-3.21.693"
        />
      </svg>
    </button>
  );
}

export function SkipSecondButton({ seconds }: { seconds: number }) {
  const isForward = seconds > 0;
  const Icon = isForward ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.633 10.5c.806 0 1.533-.446 1.933-1.08a1.498 1.498 0 012.54 0c.4.634 1.127 1.08 1.933 1.08M14.5 21h-4.873a4.992 4.992 0 01-4.694-3.667M16.633 10.5c-.806 0-1.533-.446-1.933-1.08a1.498 1.498 0 012.54 0c.4.634 1.127 1.08 1.933 1.08M5.21 6.633A4.993 4.993 0 0112 3c1.152 0 2.243.26 3.21.693M6.633 10.5a4.978 4.978 0 00-2.577-.698A4.993 4.993 0 003c1.152 0 2.243.26 3.21.693m7.157-.693a4.982 4.982 0 012.577-.698A4.993 4.993 0 0112 3c-1.152 0-2.243.26-3.21.693"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.625 12l7.125-7.5M4.501 9.633v-.001c0-.806.327-1.599.898-2.166C6.971 6.011 7.715 5.773 8.501 5.773h12a2.25 2.25 0 012.25 2.25v.001a2.25 2.25 0 01-.659 1.591l-7.5 7.5a2.25 2.25 0 01-3.182 0z"
      />
    </svg>
  );

  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
      {Icon}
    </button>
  );
}

export function BackSecondButton({ seconds }: { seconds: number }) {
  return <SkipSecondButton seconds={-Math.abs(seconds)} />;
}
