import { ApiClient } from "../api/client";
import { MutationWatcher } from "../page/mutation-watcher";
import { ActionExecutor } from "../navigation/action-executor";
import { TurnPlan } from "../page/manifest";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

export type AssistantState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "tour"
  | "error";

export class ChatController {
  private apiClient: ApiClient;
  private mutationWatcher: MutationWatcher;
  private actionExecutor: ActionExecutor | null = null;
  private messages: ChatMessage[] = [];
  private state: AssistantState = "idle";
  private onStateChange?: (state: AssistantState) => void;
  private onMessagesChange?: (messages: ChatMessage[]) => void;
  private onSessionExpired?: () => Promise<void>;

  constructor(
    apiClient: ApiClient,
    mutationWatcher: MutationWatcher,
    onStateChange?: (state: AssistantState) => void,
    onMessagesChange?: (messages: ChatMessage[]) => void,
    onSessionExpired?: () => Promise<void>
  ) {
    this.apiClient = apiClient;
    this.mutationWatcher = mutationWatcher;
    this.onStateChange = onStateChange;
    this.onMessagesChange = onMessagesChange;
    this.onSessionExpired = onSessionExpired;
  }

  public setActionExecutor(executor: ActionExecutor): void {
    this.actionExecutor = executor;
  }

  public getState(): AssistantState {
    return this.state;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public setState(state: AssistantState): void {
    this.state = state;
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  public addMessage(sender: "user" | "assistant" | "system", text: string): void {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    this.messages.push(msg);
    if (this.onMessagesChange) {
      this.onMessagesChange([...this.messages]);
    }
  }

  public async sendMessage(
    text: string,
    inputMode: "text" | "voice_transcript" = "text"
  ): Promise<TurnPlan | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Interrupt any active tour or speech
    if (this.actionExecutor) {
      this.actionExecutor.stop();
    }

    this.addMessage("user", trimmed);
    this.setState("thinking");

    let retryCount = 0;
    while (retryCount <= 1) {
      try {
        const revision = this.mutationWatcher.getRevision();
        const plan = await this.apiClient.submitTurn(trimmed, revision, inputMode);

        this.addMessage("assistant", plan.answer);

        if (this.actionExecutor) {
          await this.actionExecutor.executePlan(plan);
        }

        this.setState("idle");
        return plan;
      } catch (err: any) {
        if (err?.code === "PAGE_REVISION_STALE" && retryCount === 0) {
          // Re-sync manifest and retry once
          retryCount++;
          const newManifest = await this.mutationWatcher.buildInitialManifest();
          await this.apiClient.upsertManifest(newManifest);
          continue;
        }

        if (err?.code === "SESSION_EXPIRED" && retryCount === 0 && this.onSessionExpired) {
          // Re-create session and re-upload manifest (LLD §16)
          retryCount++;
          try {
            await this.onSessionExpired();
            continue;
          } catch (recreateErr) {
            console.error("Failed to recover expired session:", recreateErr);
          }
        }

        console.error("Chat turn error:", err);
        this.addMessage("system", err.message || "An error occurred while answering.");
        this.setState("error");
        setTimeout(() => this.setState("idle"), 3000);
        return null;
      }
    }

    return null;
  }

  public stop(): void {
    if (this.actionExecutor) {
      this.actionExecutor.stop();
    }
    this.setState("idle");
  }
}

