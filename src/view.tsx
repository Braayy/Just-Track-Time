import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Tracking } from "./types";
import { formatDate, formatDuration, formatTimeSQL, validateTimeSQL } from "./utils";
import TimeTrackerPlugin, { PluginContext } from "./main";
import { App, Modal, Notice, setIcon, Setting, TextComponent } from "obsidian";

const DatabaseSyncContext = createContext<(() => void) | null>(null);

export function TimeTrackerView() {
  const plugin = useContext(PluginContext)!;

  const [taskDescription, setTaskDescription] = useState("");
  const [trackings, setTrackings] = useState<Tracking[]>([]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  function syncTrackings() {
    const trackings = plugin.database.fetchTrackings(selectedDate, null);

    setTrackings(trackings);
  }

  useEffect(() => {
    syncTrackings();
  }, [selectedDate]);

  function handleStart() {
    if (!taskDescription) return;

    plugin.database.endLastTracking();
    plugin.database.createTracking(taskDescription);
    plugin.database.save().then(() => syncTrackings());

    setTaskDescription("");
  }

  function handleEnd() {
    plugin.database.endLastTracking();
    plugin.database.save().then(() => syncTrackings());
  }

  return (
    <div className="time-tracker-view">
      <div className="tt-header">
        <button>Report</button>
        <input type="text" placeholder="Task" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
        <div className="tt-header__buttons">
          <button onClick={handleStart}>Start</button>
          <button onClick={handleEnd} disabled={trackings.length === 0 || !!trackings.last()?.endTime}>Stop</button>
        </div>
      </div>
      <div className="tt-trackings">
        <PeriodSelector selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
        <DatabaseSyncContext.Provider value={syncTrackings}>
          <Trackings trackings={trackings} />
        </DatabaseSyncContext.Provider>
      </div>
    </div>
  );
}

type PeriodSelectorProps = {
  selectedDate: Date;
  setSelectedDate(selectedDate: Date): void;
};

function PeriodSelector({ selectedDate, setSelectedDate }: PeriodSelectorProps) {
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIcon(previousButtonRef.current!, "chevron-left");
    setIcon(nextButtonRef.current!, "chevron-right");
  }, [previousButtonRef, nextButtonRef]);

  function handleClick(dateDelta: number) {
    const newSelectedDate = new Date(selectedDate);
    newSelectedDate.setDate(newSelectedDate.getDate() + dateDelta);

    if (newSelectedDate.valueOf() > new Date().valueOf()) {
      return;
    }

    setSelectedDate(newSelectedDate);
  }

  return (
    <div className="tt-period-selector">
      <button ref={previousButtonRef} onClick={() => handleClick(-1)}></button>
      <p>{formatDate(selectedDate)}</p>
      <button ref={nextButtonRef} onClick={() => handleClick(+1)}></button>
    </div>
  );
}

type TrackingsProps = {
  trackings: Tracking[];
};

function Trackings({ trackings }: TrackingsProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [time]);

  return (
    <table>
      <tbody>
        {trackings.map((tracking) => (
          <TrackingRow key={tracking.id} tracking={tracking} />
        ))}
      </tbody>
    </table>
  );
}

type TrackingRowProps = {
  tracking: Tracking;
};

function TrackingRow({ tracking }: TrackingRowProps) {
  const plugin = useContext(PluginContext)!;
  const syncTrackings = useContext(DatabaseSyncContext)!;

  function handleClick() {
    new EditTrackingModal(plugin.app, tracking, plugin, syncTrackings).open();
  }

  function formatTrackingStartTime(): string {
    const startHour = tracking.startTime.getHours();
    const startMinute = tracking.startTime.getMinutes();

    return `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
  }

  function formatTrackingDuration() {
    const endTime = tracking.endTime ? tracking.endTime : new Date();

    return formatDuration(endTime.valueOf() - tracking.startTime.valueOf());
  }

  return (
    <tr className="tt-tracking" onClick={handleClick}>
      <td>{formatTrackingStartTime()}</td>
      <td>{tracking.description}</td>
      <td>{formatTrackingDuration()}</td>
    </tr>
  );
}

class EditTrackingModal extends Modal {
  constructor(app: App, tracking: Tracking, plugin: TimeTrackerPlugin, syncTrackings: () => void) {
    super(app);
    this.setTitle("Edit Tracking");

    let description = tracking.description;
    let startTime = formatTimeSQL(tracking.startTime);
    let endTime = tracking.endTime ? formatTimeSQL(tracking.endTime) : "";

    new Setting(this.contentEl)
      .setName("Description")
      .addText((text) => {
        text.setValue(description);

        text.onChange((value) => {
          description = value;
        })
      });

    new Setting(this.contentEl)
      .setName("Start Time")
      .addText((text) => {
        text.setValue(startTime);

        text.onChange((value) => {
          startTime = value;
        });
      });

    const endTimeComponent = new Setting(this.contentEl)
      .setName("End Time")
      .addButton((button) => {
        button
          .setButtonText("Now")
          .onClick(() => {
            endTime = formatTimeSQL(new Date());
            (endTimeComponent.components[1] as TextComponent).setValue(endTime);
          });
      })
      .addText((text) => {
        text.setValue(endTime);

        text.onChange((value) => {
          endTime = value;
        });
      });

    const buttonsEl = new Setting(this.contentEl)
      .addButton((button) => {
        button
          .setButtonText("Delete")
          .onClick(() => {
            plugin.database.deleteTracking(tracking.id);
            plugin.database.save().then(() => syncTrackings());

            this.close();
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Confirm")
          .setCta()
          .onClick(() => {
            try {
              validateTimeSQL(startTime);
              endTime && validateTimeSQL(endTime);

              plugin.database.updateTracking(tracking.id, description, startTime, endTime || null);
              plugin.database.save().then(() => syncTrackings());

              this.close();
            } catch (err) {
              new Notice(`Error: ${err}`);
            }
          });
      })
      .setClass("tt-edit-tracking-modal__buttons")
      .settingEl;

    buttonsEl.children.item(0)?.remove();
    console.log(buttonsEl);
  }
}
