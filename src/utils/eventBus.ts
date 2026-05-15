import { EventEmitter } from "events";
export const appEventBus = new EventEmitter();

export const USER_UPDATED_EVENT = "user:updated";
export const MUSIC_STATE_UPDATED_EVENT = "music:updated";
export const WEATHER_STATE_UPDATED_EVENT = "weather:updated";
export const TAMAGOTCHI_STATE_UPDATED_EVENT = "tamagotchi:updated";
export const COMMAND_SEND_STATE = "command:send_state";
export const COMMAND_SEND_SETTINGS = "command:send_settings";
