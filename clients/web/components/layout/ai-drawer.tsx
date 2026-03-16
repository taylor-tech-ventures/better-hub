import { BotIcon, XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Session } from '@/server/auth/client';
import { Button } from '@/web/components/ui/button';
import { ChatInterface } from '@/web/components/ui/chat/interface';
import { cn } from '@/web/lib/utils';

const AI_SUGGESTIONS = [
  'List all organization repositories',
  'Show team members and their roles',
  'Check branch protection rules',
  'Review security alerts',
];

type AiDrawerProps = {
  open: boolean;
  onClose: () => void;
  session: Session;
};

export function AiDrawer({ open, onClose, session }: AiDrawerProps) {
  // Only mount ChatInterface after the drawer has been opened at least once —
  // prevents useAgentChat from running during SSR or before the user needs it.
  const everOpened = useRef(false);
  useEffect(() => {
    if (open) everOpened.current = true;
  }, [open]);

  return (
    <div
      className={cn(
        'flex flex-col border-l bg-background overflow-hidden transition-all duration-200 ease-in-out shrink-0',
        open ? 'w-[400px]' : 'w-0',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <BotIcon className="size-5 text-primary shrink-0" />
        <span className="flex-1 text-sm font-semibold whitespace-nowrap">
          AI Assistant
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close AI assistant</span>
        </Button>
      </div>

      {/* Chat — only mounted after first open to avoid SSR agent connection */}
      <div className="flex-1 overflow-hidden">
        {everOpened.current && (
          <ChatInterface
            agent="GitHubAgent"
            name={session.user.id}
            className="h-full"
            placeholder="Ask the AI assistant..."
            emptyTitle="How can I help?"
            emptyDescription="Ask me anything about your GitHub organization."
            suggestions={AI_SUGGESTIONS}
          />
        )}
      </div>
    </div>
  );
}
