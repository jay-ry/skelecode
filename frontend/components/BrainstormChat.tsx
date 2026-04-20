"use client";
import { useCopilotAction, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";

interface BrainstormChatProps {
  onMarkdownUpdate: (markdown: string) => void;
  onStreamingChange: (isStreaming: boolean) => void;
  onError: (hasError: boolean) => void;
}

export function BrainstormChat({
  onMarkdownUpdate,
  onStreamingChange,
  onError,
}: BrainstormChatProps) {
  const { visibleMessages } = useCopilotChat();

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
      onMarkdownUpdate(""); // Clear previous content
      onError(false);

      // Serialize conversation from CopilotKit's message store
      // visibleMessages is Message[] from @copilotkit/runtime-client-gql
      // Only TextMessage instances have role + content; filter others out
      const conversation = visibleMessages
        .filter((msg) => msg.isTextMessage())
        .map((msg) => {
          const textMsg = msg as { role: string; content: string };
          return {
            role: textMsg.role === "user" ? "user" : "assistant",
            content: textMsg.content ?? "",
          };
        });

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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();

            if (payload === "[DONE]") {
              onStreamingChange(false);
              return "Spec generated successfully. Check the preview panel on the right.";
            }

            try {
              const event = JSON.parse(payload);
              if (event.node === "drafter" && event.data?.project_md) {
                onMarkdownUpdate(event.data.project_md);
              }
            } catch {
              // Partial JSON chunk — skip silently
            }
          }
        }
      } catch (err) {
        onStreamingChange(false);
        onError(true);
        throw err; // Re-throw so CopilotKit shows error in chat
      }
    },
    render: ({ status }) => {
      if (status === "inProgress") {
        return (
          <div className="text-sm text-gray-500 mt-2 font-mono">
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
