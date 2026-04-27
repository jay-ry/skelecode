"use client";
import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";

interface HeaderProps {
  projectId?: string;
  onTogglePreview?: () => void;
  previewOpen?: boolean;
  onStartOver?: () => void;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloadLabel?: string;
}

const btnClass =
  "text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors";

const STEPS = [
  { key: "chat", label: "Chat" },
  { key: "sprints", label: "Sprints" },
  { key: "skeleton", label: "Skeleton" },
] as const;

export function Header({
  projectId,
  onTogglePreview,
  previewOpen,
  onStartOver,
  onDownload,
  downloadDisabled,
  downloadLabel = "Download",
}: HeaderProps) {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  const currentStep = pathname.includes("/skeleton/")
    ? "skeleton"
    : pathname.includes("/sprints/")
    ? "sprints"
    : pathname.includes("/chat/")
    ? "chat"
    : null;

  return (
    <header className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,255,224,0.15)] shrink-0">
      {/* Logo → Dashboard */}
      <Link href="/" className="flex items-center gap-2.5 group shrink-0">
        <Image
          src="/skelecode-logo.png"
          alt="SkeleCode"
          width={28}
          height={28}
          style={{ filter: "drop-shadow(0 0 5px rgba(0,255,224,0.6))" }}
        />
        <span className="font-mono text-sm font-semibold tracking-tight text-[#00ffe0] group-hover:text-white transition-colors">
          SkeleCode
        </span>
      </Link>

      {/* Step nav — only shown inside a project flow */}
      {projectId && currentStep && (
        <nav className="flex items-center gap-1" aria-label="Project steps">
          {STEPS.map((step, i) => {
            const href = `/${step.key}/${projectId}`;
            const isActive = step.key === currentStep;
            return (
              <Fragment key={step.key}>
                {i > 0 && (
                  <span className="text-[rgba(0,255,224,0.25)] text-xs px-1 select-none">—</span>
                )}
                <Link
                  href={href}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded transition-colors ${
                    isActive
                      ? "text-[#00ffe0]"
                      : "text-[#7abfb8] hover:text-[#c8f0ea] hover:bg-[#050d14]"
                  }`}
                >
                  <span
                    className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive
                        ? "bg-[#00ffe0] text-[#020408]"
                        : "border border-[rgba(0,255,224,0.3)] text-[#7abfb8]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {step.label}
                </Link>
              </Fragment>
            );
          })}
        </nav>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onTogglePreview && (
          <button type="button" onClick={onTogglePreview} className={btnClass}>
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
        )}

        {onStartOver && (
          <button type="button" onClick={onStartOver} className={btnClass}>
            Start over
          </button>
        )}

        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloadDisabled}
            className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {downloadLabel}
          </button>
        )}

        {isSignedIn ? (
          <>
            <Link href="/" className={btnClass}>
              Dashboard
            </Link>
            <UserButton />
          </>
        ) : (
          <Link href="/sign-in" className={btnClass}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
