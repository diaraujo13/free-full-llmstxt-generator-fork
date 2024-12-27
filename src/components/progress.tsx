import { Progress } from "@/components/ui/progress";
import { GenerationStatus } from "@/types";

interface GenerationProgressProps {
  status: GenerationStatus;
}

export function GenerationProgress({ status }: GenerationProgressProps) {
  const getProgress = () => {
    switch (status) {
      case 'fetching':
        return 25;
      case 'parsing':
        return 50;
      case 'formatting':
        return 75;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'fetching':
        return 'Fetching webpage...';
      case 'parsing':
        return 'Extracting content...';
      case 'formatting':
        return 'Formatting content...';
      case 'complete':
        return 'Complete!';
      case 'error':
        return 'Error occurred';
      default:
        return '';
    }
  };

  if (status === 'idle') return null;

  return (
    <div className="w-full space-y-2 mt-2">
      <Progress value={getProgress()} />
      <p className="text-sm text-muted-foreground">{getMessage()}</p>
    </div>
  );
}