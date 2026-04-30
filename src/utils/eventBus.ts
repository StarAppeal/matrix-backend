import { EventEmitter } from "events";
export const appEventBus = new EventEmitter();

export const USER_UPDATED_EVENT = "user:updated";
export const MUSIC_STATE_UPDATED_EVENT = "music:updated";
export const WEATHER_STATE_UPDATED_EVENT = "weather:updated";
