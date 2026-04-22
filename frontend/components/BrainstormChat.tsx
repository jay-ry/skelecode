"use client";
import { useCopilotAction } from "@copilotkit/react-core";
import { useAgent } from "@copilotkit/react-core/v2";
import { CopilotChat } from "@copilotkit/react-ui";

interface BrainstormChatProps {
  projectId: string;
  onMarkdownUpdate: (markdown: string) => void;
  onStreamingChange: (isStreaming: boolean) => void;
  onError: (hasError: boolean) => void;
}

export function BrainstormChat({
  projectId,
  onMarkdownUpdate,
  onStreamingChange,
  onError,
}: BrainstormChatProps) {
  const { agent } = useAgent();

  useCopilotAction({
    name: "generateProjectSpec",
    description:
      "Call this after 4-5 exchanges to generate the project.md specification. " +
      "Call it when you have gathered: the problem, target users, core features, " +
      "tech preferences, and constraints.",
    parameters: [
      {
        name: "summary",
        type: "string",
        description:
          "Brief summary of the conversation so far — confirms to the user what you are generating from.",
        required: true,
      },
    ],
    handler: async ({ summary: _summary }) => {
      onStreamingChange(true);
      onMarkdownUpdate("");
      onError(false);
      let finalProjectMd = "";

      const conversation = (agent.messages ?? [])
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: typeof msg.content === "string" ? msg.content : "",
        }));

      try {
        const response = await fetch("/api/brainstorm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();

            if (payload === "[DONE]") {
              onStreamingChange(false);

              // Generate AI name then update project (fire-and-forget; tolerate failures)
              try {
                const nameRes = await fetch("/api/name", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ project_md: finalProjectMd }),
                });
                const { name } = nameRes.ok
                  ? (await nameRes.json() as { name: string })
                  : { name: "Untitled Project" };

                await fetch(`/api/projects/${projectId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, project_md: finalProjectMd }),
                });
              } catch (e) {
                console.warn("[BrainstormChat] Name/save update skipped", e);
              }

              return "Spec generated successfully. Check the preview panel on the right.";
            }

            try {
              const event = JSON.parse(payload);
              if (event.node === "drafter" && event.data?.project_md) {
                finalProjectMd = event.data.project_md;
                onMarkdownUpdate(event.data.project_md);
              }
            } catch {
              // Partial JSON — skip
            }
          }
        }
      } catch (err) {
        onStreamingChange(false);
        onError(true);
        throw err;
      }
    },
    render: ({ status }) => {
      if (status === "inProgress") {
        return (
          <div className="text-sm text-[#00ffe0] mt-2 font-mono animate-pulse">
            Generating your project spec...
          </div>
        );
      }
      return <></>;
    },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0 h-full">
      <CopilotChat
        className="h-full"
        instructions={`You are a project brainstorm interviewer for SkeleCode, an AI project planning tool.

Your job: interview the user to extract their project idea, then generate a project.md spec.

Rules:
- Ask ONE question at a time. Wait for each answer before asking the next.
- Ask about: the core problem, who it's for, key features (3-5), tech preferences, and constraints.
- If the user has no idea, suggest exactly 3 specific project ideas (not categories — real project names with one-sentence descriptions). Let them pick one, then continue the interview.
- Show empathy and interest — this is a conversation, not a form.
- After 4-5 exchanges where you have ALL of: core problem, target users, key features, tech preferences, and at least one constraint — call generateProjectSpec with a one-sentence summary.
- Do NOT call generateProjectSpec until you have gathered all five pieces of information.
- Do NOT repeat questions for information the user already provided.`}
        labels={{
          title: "Brainstorm Bot",
          initial:
            "What kind of project do you want to build? (Or say 'I have no idea' and I'll suggest some options.)",
        }}
      />
    </div>
  );
}
