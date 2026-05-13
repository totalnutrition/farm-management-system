"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Tick02Icon,
  CircleArrowRight02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  SetupStepDone,
  SetupStepIdentity,
  WizardSteps,
  pathLocationDetail,
  pathLocationSetup,
  type SetupStep,
} from "@/lib/misc";
import { advanceSetupStep, skipSetup } from "../../actions";

export type WizardLocation = {
  id: string;
  name: string;
  short_code: string;
  manages_livestock: boolean;
  manages_crops: boolean;
  setup_step: string;
};

function relevantSteps(loc: WizardLocation) {
  return WizardSteps.filter((s) => {
    if (s.livestockOnly && !loc.manages_livestock) return false;
    if (s.cropsOnly && !loc.manages_crops) return false;
    return true;
  });
}

function nextStep(
  loc: WizardLocation,
  current: SetupStep,
): SetupStep | typeof SetupStepDone {
  const steps = relevantSteps(loc);
  const idx = steps.findIndex((s) => s.key === current);
  if (idx === -1 || idx === steps.length - 1) return SetupStepDone;
  return steps[idx + 1].key;
}

export function WizardShell({
  location,
  currentStep,
  children,
}: {
  location: WizardLocation;
  currentStep: SetupStep;
  children: React.ReactNode;
}) {
  const steps = relevantSteps(location);
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  const total = steps.length;

  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const current = steps[currentIdx];
  const next = nextStep(location, currentStep);
  const prevStep = currentIdx > 0 ? steps[currentIdx - 1].key : null;

  const onNext = () => {
    startTransition(async () => {
      const result = await advanceSetupStep({ id: location.id, to: next });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (next === SetupStepDone) {
        toast.success("Setup complete.");
        router.push(pathLocationDetail(location.id));
      } else {
        router.push(`${pathLocationSetup(location.id)}/${next}`);
      }
    });
  };

  const onSkipAll = () => {
    startTransition(async () => {
      await skipSetup(location.id);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground mb-2">
          <Link
            href={pathLocationDetail(location.id)}
            className="hover:underline"
          >
            {location.name}
          </Link>
          <span className="block font-mono text-[10px] mt-0.5">
            {location.short_code} · Setup
          </span>
        </div>
        <ol className="flex flex-col gap-0.5">
          {steps.map((s, idx) => {
            const isCurrent = s.key === currentStep;
            const isComplete = idx < currentIdx;
            const shipped = s.shipped;
            return (
              <li key={s.key}>
                {shipped && idx <= currentIdx ? (
                  <Link
                    href={`${pathLocationSetup(location.id)}/${s.key}`}
                    className={`flex items-start gap-2 px-2 py-1.5 text-xs ${
                      isCurrent
                        ? "bg-foreground/5 ring-1 ring-foreground/15"
                        : "hover:bg-foreground/5"
                    }`}
                  >
                    <span className="shrink-0 mt-0.5">
                      {isComplete ? (
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          className="size-3.5 text-primary"
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={CircleArrowRight02Icon}
                          className={`size-3.5 ${
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className={isCurrent ? "font-medium" : ""}>
                        {idx + 1}. {s.label}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-start gap-2 px-2 py-1.5 text-xs opacity-60">
                    <span className="shrink-0 mt-0.5">
                      <HugeiconsIcon
                        icon={CircleArrowRight02Icon}
                        className="size-3.5 text-muted-foreground"
                      />
                    </span>
                    <span className="flex flex-col">
                      <span>
                        {idx + 1}. {s.label}
                      </span>
                      {!shipped ? (
                        <span className="text-[10px] text-muted-foreground">
                          coming soon
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 px-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={isPending}
            onClick={onSkipAll}
          >
            Skip setup for now
          </Button>
        </div>
      </aside>

      <main className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Step {currentIdx + 1} of {total}
          </p>
          <h2 className="font-heading text-xl font-medium">{current?.label}</h2>
          <p className="text-xs text-muted-foreground">
            {current?.description}
          </p>
        </header>

        <section className="flex flex-col gap-4">{children}</section>

        <footer className="flex items-center justify-between gap-2 border-t pt-4">
          <div>
            {prevStep ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={`${pathLocationSetup(location.id)}/${prevStep}`}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} />
                  Back
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {currentStep !== SetupStepIdentity && !current?.shipped ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={onNext}
              >
                Skip this step
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={onNext}
            >
              {next === SetupStepDone ? "Finish" : "Next"}
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
