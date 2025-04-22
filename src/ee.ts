import { createContext, useContext, useEffect } from "react";

export class TimeTrackerEventEmitter extends EventTarget { }

export const EventEmitterContext = createContext<TimeTrackerEventEmitter | null>(null);

export function useEventEmitter(eventName: string, listener: (event: any) => void) {
  const eventEmitter = useContext(EventEmitterContext);

  useEffect(() => {
    eventEmitter?.addEventListener(eventName, listener);

    return () => eventEmitter?.removeEventListener(eventName, listener);
  }, [eventName, listener]);
}
