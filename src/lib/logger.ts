import { IS_DEBUG } from "@/config/game";

export const log = {
    debug: (...args: any[]) => IS_DEBUG && console.debug(...args),
    info: (...args: any[]) => console.info(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
};
