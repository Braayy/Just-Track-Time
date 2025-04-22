import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { createContext, StrictMode } from 'react';
import { createRoot, Root } from "react-dom/client";
import { TrackingDatabase } from './db';
import { EventEmitterContext, TimeTrackerEventEmitter } from './ee';
import { TimeTrackerView } from "./view";

const SQLJS_WASM_MODULE_FILENAME = "sql-wasm.wasm";
const DATABASE_FILENAME = "time-tracker.db";

export default class TimeTrackerPlugin extends Plugin {
  database: TrackingDatabase;
  eventEmitter: TimeTrackerEventEmitter;

  async onload() {
    this.eventEmitter = new TimeTrackerEventEmitter();

    this.database = new TrackingDatabase(this, DATABASE_FILENAME);
    await this.database.init(SQLJS_WASM_MODULE_FILENAME);

    this.registerView(TIME_TRACKER_VIEW, (leaf) => new TimeTrackerItemView(leaf, this));

    this.addRibbonIcon('clock', 'Time Tracker', async (event: MouseEvent) => {
      const workspace = this.app.workspace;

      let leaf: WorkspaceLeaf | null = null;
      const leaves = workspace.getLeavesOfType(TIME_TRACKER_VIEW);

      if (leaves.length > 0) {
        leaf = leaves[0];
      } else {
        leaf = workspace.getLeaf("tab");
        await leaf?.setViewState({ type: TIME_TRACKER_VIEW, active: true });
      }

      workspace.revealLeaf(leaf);
    });
  }

  async onunload() {
    await this.database.save();
  }
}

export const PluginContext = createContext<TimeTrackerPlugin | null>(null);

const TIME_TRACKER_VIEW = "time-tracker-view";

class TimeTrackerItemView extends ItemView {
  plugin: TimeTrackerPlugin;
  root: Root;

  constructor(leaf: WorkspaceLeaf, plugin: TimeTrackerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TIME_TRACKER_VIEW;
  }

  getDisplayText(): string {
    return "Time Tracker";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.root.render(
      <StrictMode>
        <EventEmitterContext.Provider value={this.plugin.eventEmitter}>
          <PluginContext.Provider value={this.plugin}>
            <TimeTrackerView />
          </PluginContext.Provider>
        </EventEmitterContext.Provider>
      </StrictMode>
    );
  }

  async onClose() {
    this.root.unmount();
  }
}
