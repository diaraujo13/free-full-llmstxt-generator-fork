export function RemainingRequests({ remaining }: { remaining: number }) {
  return (
    <span className="text-sm font-normal text-muted-foreground">
      {remaining > 0 ? `(${remaining} requests remaining)` : "(All requests used)"}
    </span>
  );
}