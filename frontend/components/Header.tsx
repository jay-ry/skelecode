"use client";
import Image from "next/image";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";

interface HeaderProps {
  backHref?: string;
  backLabel?: string;
  forwardHref?: string;
  forwardLabel?: string;
  onTogglePreview?: () => void;
  previewOpen?: boolean;
  onStartOver?: () => void;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloadLabel?: string;
}

const btnClass =
  "text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors";

export function Header({
  backHref,
  backLabel,
  forwardHref,
  forwardLabel,
  onTogglePreview,
  previewOpen,
  onStartOver,
  onDownload,
  downloadDisabled,
  downloadLabel = "Download",
}: HeaderProps) {
  const { isSignedIn } = useUser();
  return (
    <header className="flex items-center justify-between px-5 py-2.5 border-b border-[rgba(0,255,224,0.15)] shrink-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 group">
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

      {/* Actions */}
      <div className="flex items-center gap-2">
        {backHref && (
          <Link href={backHref} className={btnClass}>
            {backLabel ?? "← Back"}
          </Link>
        )}

        {forwardHref && (
          <Link href={forwardHref} className={btnClass}>
            {forwardLabel ?? "Next →"}
          </Link>
        )}

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
            <Link href="/dashboard" className={btnClass}>
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
