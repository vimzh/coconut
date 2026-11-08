"use client";

// Ranked rows retain public identities, qualification reasons and all repeated-run links.
import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const number = (value: number | null) =>
  value === null ? "Unavailable" : value.toFixed(4);
const when = (value: string) => new Date(value).toLocaleString();

function EvidenceDetails({ entry }: { entry: LeaderboardEntry }) {
  const repeated = entry.repeatedRunIds.length > 1;
  return (
    <details className="max-w-sm whitespace-normal text-xs leading-5">
      <summary className="cursor-pointer text-muted-foreground">
        Identity and eligibility
        {repeated ? ` · ${entry.repeatedRunIds.length} publications` : ""}
      </summary>
      <dl className="mt-3 space-y-2">
        <div>
          <dt className="text-muted-foreground">Requested route</dt>
          <dd className="break-all">
            {entry.provider} / {entry.requestedServingProvider ?? "direct"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reported model</dt>
          <dd className="break-all font-mono">
            {entry.reportedModels.join(", ") || "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reported serving provider</dt>
          <dd>{entry.reportedProviders.join(", ") || "Unknown"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{when(entry.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evidence expires</dt>
          <dd>{when(entry.expiresAt)}</dd>
        </div>
      </dl>
      {entry.reasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-4">
          {entry.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {entry.eligible && entry.representativeId !== entry.id && (
        <p className="mt-3">
          An earlier eligible publication represents this model in the ranking.
        </p>
      )}
      {repeated && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {entry.repeatedRunIds.map((id, index) => (
            <Link
              className="text-primary underline underline-offset-4"
              key={id}
              href={`/results/${id}`}
            >
              Publication {index + 1}
              {id === entry.id ? " (this run)" : ""}
            </Link>
          ))}
        </div>
      )}
    </details>
  );
}

export function ComparisonTable({
  entries,
  selected,
  onSelect,
  disabled,
}: {
  entries: readonly LeaderboardEntry[];
  selected: readonly string[];
  onSelect: (id: string, checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Table>
      <TableCaption>
        Macro-F1 uses the retained scorer report. Trial range is descriptive
        min–max across three repeated passes, not a confidence interval.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Compare</TableHead>
          <TableHead>Rank</TableHead>
          <TableHead>Requested model</TableHead>
          <TableHead>Macro-F1</TableHead>
          <TableHead>Trial range</TableHead>
          <TableHead>Accuracy</TableHead>
          <TableHead>Population</TableHead>
          <TableHead>Unusable</TableHead>
          <TableHead>Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={`Compare ${entry.requestedModel}, run ${entry.id}`}
                checked={selected.includes(entry.id)}
                disabled={
                  disabled ||
                  !entry.eligible ||
                  (selected.length >= 4 && !selected.includes(entry.id))
                }
                onChange={(event) => onSelect(entry.id, event.target.checked)}
              />
            </TableCell>
            <TableCell className="font-mono">{entry.rank ?? "—"}</TableCell>
            <TableCell>
              <Link
                className="font-medium text-primary underline-offset-4 hover:underline"
                href={`/results/${entry.id}`}
              >
                {entry.requestedModel}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">
                {entry.provider}
                {entry.rank === null
                  ? entry.eligible
                    ? " · repeated run"
                    : " · unranked"
                  : ""}
              </div>
            </TableCell>
            <TableCell className="font-mono" title={entry.macroF1?.toString()}>
              {number(entry.macroF1)}
            </TableCell>
            <TableCell className="font-mono">
              {number(entry.trialMin)} – {number(entry.trialMax)}
            </TableCell>
            <TableCell className="font-mono">
              {number(entry.accuracy)}
            </TableCell>
            <TableCell>
              {entry.included}/{entry.planned}
            </TableCell>
            <TableCell>{entry.unusable}</TableCell>
            <TableCell>
              <EvidenceDetails entry={entry} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
