"use client";

// A searchable, source-attributed catalog; usage ranks are separate from evaluation scores.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { directoryModels, directorySnapshot, modelCompanies, type DirectoryModel } from "@/lib/model-directory-data";
import { filterDirectoryModels, type DirectorySource } from "@/lib/model-directory";
import styles from "./model-directory.module.css";

const sources = [
  { id: "all", label: "All models", count: directoryModels.length },
  { id: "openrouter", label: "OpenRouter", count: directoryModels.filter((model) => model.openrouter !== null).length },
  { id: "openai", label: "OpenAI", count: directoryModels.filter((model) => model.openai).length },
] as const;

const snapshotDate = new Date(directorySnapshot.retrievedAt).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const usageEndDate = new Date(directorySnapshot.openRouter.periodEnd).toLocaleDateString("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

function ModelRow({ model, source }: { model: DirectoryModel; source: DirectorySource }) {
  const company = modelCompanies[model.company];
  const url = source === "openrouter" && model.openrouter
    ? `https://openrouter.ai/${model.openrouter.modelId}`
    : model.url;
  return (
    <TableRow>
      <TableCell className={styles.rank}>
        {model.openrouter ? String(model.openrouter.rank).padStart(2, "0") : <span aria-label="Not in OpenRouter top ten">—</span>}
      </TableCell>
      <TableCell className={styles.modelCell}>
        <div className={styles.identity}>
          <span className={styles.logo}><Image src={company.logo} alt="" width={26} height={26} unoptimized /></span>
          <div className={styles.modelText}>
            <div className={styles.nameLine}>
              <a href={url} target="_blank" rel="noreferrer" className={styles.modelLink}>
                {model.name}<ArrowUpRight size={13} aria-hidden="true" />
              </a>
              {model.status !== "listed" && <span className={styles.status}>{model.status === "deprecated" ? "Deprecated" : "Open weights"}</span>}
            </div>
            <span className={styles.modelId}>{model.id}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className={styles.sourceCell}>
        <span className="sr-only">{company.name}. </span>
        <div className={styles.sourceLabels}>
          {model.openrouter && <span>OpenRouter</span>}
          {model.openai && <span>OpenAI</span>}
        </div>
      </TableCell>
      <TableCell className={styles.tokens}>
        {model.openrouter ? model.openrouter.tokens : <span aria-label="No weekly usage figure in this snapshot">—</span>}
      </TableCell>
    </TableRow>
  );
}

export function ModelDirectory() {
  const [source, setSource] = useState<DirectorySource>("all");
  const [query, setQuery] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const models = filterDirectoryModels(directoryModels, source, query);

  useEffect(() => {
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }, [source, query]);

  return (
    <section aria-labelledby="model-directory-title" className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2 id="model-directory-title">The model catalog</h2>
          <p>OpenRouter’s 10 weekly usage leaders, alongside OpenAI’s current and deprecated text models.</p>
        </div>
        <p className={styles.snapshot}>Snapshot <span>{snapshotDate}</span></p>
      </div>

      <div className={styles.catalog}>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Filter models by source">
            {sources.map((option) => (
              <button key={option.id} type="button" aria-pressed={source === option.id} aria-controls="model-catalog-table" onClick={() => setSource(option.id)}>
                {option.label}<span>{option.count}</span>
              </button>
            ))}
          </div>
          <div className={styles.search}>
            <label htmlFor="model-search" className="sr-only">Search models by name, company, or model ID</label>
            <Search size={16} aria-hidden="true" />
            <Input id="model-search" type="search" placeholder="Search models or companies" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 border-border bg-transparent pl-9 shadow-none" aria-controls="model-catalog-table" />
          </div>
        </div>

        <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="Model catalog; scroll to see all rows and columns">
          <Table id="model-catalog-table" className={styles.table}>
            <caption className="sr-only">Model catalog. Rank and weekly tokens refer to OpenRouter usage, not CoconutEval performance.</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className={styles.rank}>Rank</TableHead>
                <TableHead scope="col">Model / company</TableHead>
                <TableHead scope="col">Catalog</TableHead>
                <TableHead scope="col" className={styles.tokens}>Weekly tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => <ModelRow key={model.id} model={model} source={source} />)}
              {models.length === 0 && <TableRow><TableCell colSpan={4} className={styles.empty}>No matching models. Try a model name, company, or ID.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>

        <div className={styles.summary}>
          <p aria-live="polite" aria-atomic="true"><span>{models.length}</span> {models.length === 1 ? "model" : "models"} shown</p>
          <p>Usage rank measures token volume. Model access varies by provider.</p>
        </div>
      </div>

      <div className={styles.sources}>
        <p><a href={directorySnapshot.openRouter.url} target="_blank" rel="noreferrer">OpenRouter rankings</a> · Usage through {usageEndDate} · <a href={directorySnapshot.openRouter.licenseUrl} target="_blank" rel="noreferrer">CC BY 4.0</a></p>
        <p><a href={directorySnapshot.openAI.url} target="_blank" rel="noreferrer">OpenAI model catalog</a> · Text/code catalog entries; retired models excluded.</p>
      </div>
    </section>
  );
}
