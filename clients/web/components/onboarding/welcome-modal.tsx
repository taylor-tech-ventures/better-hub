import {
  GitBranchIcon,
  MessageSquareIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/web/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/web/components/ui/card';

const ONBOARDING_KEY = 'gh-admin:onboarding-completed';

const STEPS = [
  {
    icon: SearchIcon,
    title: 'Explore Your Organizations',
    description:
      'Start by asking the AI to list your GitHub organizations and repositories. Try: "List all repos in my org"',
  },
  {
    icon: GitBranchIcon,
    title: 'Manage Repos & Teams',
    description:
      'Create repos, manage team access, copy branch protection rules — all through natural language.',
  },
  {
    icon: ShieldIcon,
    title: 'Safe by Default',
    description:
      'Destructive actions (delete, remove, update) always show an Approve/Deny dialog before executing.',
  },
  {
    icon: MessageSquareIcon,
    title: 'Try a Read-Only Command',
    description:
      'Open the AI chat and try: "List all teams in [your-org]". Read-only operations execute automatically.',
  },
] as const;

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setOpen(true);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }, []);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }, [step, handleDismiss]);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4 relative">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>

        <CardHeader className="text-center pb-2">
          {step === 0 && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Welcome to
            </p>
          )}
          <CardTitle className="text-xl">
            {step === 0 ? 'gh-admin' : current.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="size-6 text-primary" />
            </div>
            {step === 0 && (
              <p className="font-medium text-sm">{current.title}</p>
            )}
            <p className="text-sm text-muted-foreground max-w-xs">
              {current.description}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={`step-${STEPS[i].title}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={handleDismiss}
            >
              Skip
            </Button>
            <Button size="sm" className="flex-1" onClick={handleNext}>
              {isLast ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
