"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewChatPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Project", project_md: "" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ project_id: string }>;
      })
      .then(({ project_id }) => {
        if (!cancelled) router.replace(`/chat/${project_id}`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [router]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 bg-[#020408]">
        <p className="text-sm text-[#ff003c]">Failed to create project. Are you signed in?</p>
        <a href="/" className="text-sm text-[#00ffe0] underline">Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#020408]">
      <p className="text-sm text-[#7abfb8] font-mono animate-pulse">Creating project...</p>
    </div>
  );
}
