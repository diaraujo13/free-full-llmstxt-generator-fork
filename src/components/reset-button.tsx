import { RotateCcw } from "lucide-react";
import { Button } from './ui/button';

export default function ResetButton() {
  return (
    <Button type="reset">
      <RotateCcw className="h-4 w-4" /> Clear
    </Button>
  );
}