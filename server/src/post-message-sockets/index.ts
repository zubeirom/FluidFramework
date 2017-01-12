import { IPostMessageHost, PostMessageHost } from "./post-message-host";
import { IPostMessageSocket } from "./post-message-socket";

// Re-export the core interfaces
export { IPostMessageHost, IPostMessageSocket };

// The list of already created hosts
let hosts: PostMessageHost[] = [];

/**
 * Creates a new PostMessageHost for the given window
 */
export function getOrCreateHost(window: Window): IPostMessageHost {
    // See if we already have a host
    for (let host of hosts) {
        if (host.window === window) {
            return host;
        }
    }

    let host = new PostMessageHost(window);
    hosts.push(host);

    return host;
}
