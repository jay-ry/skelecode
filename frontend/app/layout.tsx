import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkeleCode — AI Project Planner",
  description: "From idea to sprint-ready plan in minutes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-[#020408] font-sans antialiased">
          <CopilotKit runtimeUrl="/api/copilotkit">
            {children}
          </CopilotKit>
        </body>
      </html>
    </ClerkProvider>
  );
}
