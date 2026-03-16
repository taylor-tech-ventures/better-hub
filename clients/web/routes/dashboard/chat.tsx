import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ChatInterface } from '@/web/components/ui/chat/interface';

const CHAT_SUGGESTIONS = [
  'List org members and their roles',
  'Show repos with open pull requests',
  'Check branch protection rules',
  'Review recent security alerts',
];

const chatSearchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute('/dashboard/chat')({
  ssr: false,
  validateSearch: chatSearchSchema,
  component: ChatPage,
});

function ChatPage() {
  const { session } = Route.useRouteContext();
  const { q } = Route.useSearch();
  const navigate = useNavigate();

  const handleInitialPromptSent = () => {
    void navigate({
      to: '/dashboard/chat',
      search: {},
      replace: true,
    });
  };

  return (
    <div className="h-full flex justify-center">
      <div className="h-full w-full max-w-4xl">
        <ChatInterface
          agent="GitHubAgent"
          name={session.user.id}
          session={session}
          className="h-full"
          placeholder="Ask about your GitHub organization..."
          emptyTitle="GitHub Admin Assistant"
          emptyDescription="Ask me anything about your organization."
          suggestions={CHAT_SUGGESTIONS}
          initialPrompt={q}
          onInitialPromptSent={handleInitialPromptSent}
        />
      </div>
    </div>
  );
}
