import type { RunJson } from "@rcc/shared";
import { File, Folder } from "lucide-react";

interface Props {
  run: RunJson | null;
}

export function ArtifactTree({ run }: Props) {
  if (!run) {
    return (
      <div>
        <p className="label mb-2">Artifacts</p>
        <p className="text-xs text-slate-500">
          Files will appear here once you create a run.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="label mb-2">Artifacts</p>
      <ul className="space-y-0.5 mono text-[12px] text-slate-400">
        <Item icon="file" label="00-original-idea.md" />
        <Item icon="file" label="01-enriched-research-prompt.md" muted />
        <Item icon="file" label="02-model-run-instructions.md" muted />
        <Item icon="folder" label="sources/" />
        <Item icon="folder" label="review/" muted />
        <Item icon="folder" label="decision/" muted />
        <Item icon="folder" label="exports/" muted />
        <Item icon="file" label="run.json" />
      </ul>
    </div>
  );
}

function Item({
  icon,
  label,
  muted = false,
}: {
  icon: "file" | "folder";
  label: string;
  muted?: boolean;
}) {
  const Icon = icon === "folder" ? Folder : File;
  return (
    <li
      className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${muted ? "opacity-50" : ""}`}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
    </li>
  );
}
