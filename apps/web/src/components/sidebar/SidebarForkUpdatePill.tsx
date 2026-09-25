import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ArrowDownToLineIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import {
  FORK_BUILD,
  fetchForkUpstreamStatus,
  forkUpdatePrompt,
  type ForkUpstreamStatus,
} from "~/forkUpdates";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { readLocalApi } from "~/localApi";
import { useProjects } from "~/state/entities";
import { Button } from "../ui/button";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function openExternal(url: string) {
  const api = readLocalApi();
  if (api) void api.shell.openExternal(url);
  else window.open(url, "_blank", "noopener");
}

/** Shows fork builds how far upstream has moved, and starts a thread that replays the fork. */
export function SidebarForkUpdatePill() {
  const [status, setStatus] = useState<ForkUpstreamStatus | null>(null);
  const projects = useProjects();
  const newThread = useNewThreadHandler();

  useEffect(() => {
    const fork = FORK_BUILD;
    if (fork === null) return;
    const controller = new AbortController();
    // A failed check keeps the last answer; GitHub's anonymous limit is the likely cause.
    const check = () =>
      void fetchForkUpstreamStatus(fork, controller.signal).then(setStatus, () => undefined);
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const fork = FORK_BUILD;
  if (fork === null || status === null || status.behindBy === 0) return null;

  const forkProject = projects.find(
    (project) =>
      project.repositoryIdentity?.owner?.toLowerCase() === fork.owner.toLowerCase() &&
      project.repositoryIdentity?.name?.toLowerCase() === fork.name.toLowerCase(),
  );
  const label = `${status.behindBy} upstream commit${status.behindBy === 1 ? "" : "s"}`;

  const startUpdate = async () => {
    if (!forkProject) {
      openExternal(status.compareUrl);
      return;
    }
    const opened = await newThread(scopeProjectRef(forkProject.environmentId, forkProject.id));
    if (opened)
      useComposerDraftStore.getState().setPrompt(opened.draftId, forkUpdatePrompt(fork, status));
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarMenuButton className="min-w-0 flex-1" onClick={() => void startUpdate()} />
              }
            >
              <ArrowDownToLineIcon />
              <span className="truncate">{label}</span>
            </TooltipTrigger>
            <TooltipPopup side="top">
              {forkProject
                ? `Open a thread in ${forkProject.title} that rebases ${fork.branch}`
                : `Add the ${fork.owner}/${fork.name} checkout as a project to update from here`}
            </TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost-muted"
                  size="icon-xs"
                  aria-label="View upstream commits"
                  onClick={() => openExternal(status.compareUrl)}
                />
              }
            >
              <ExternalLinkIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="top">View upstream commits</TooltipPopup>
          </Tooltip>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
