/**
 * Parse action input into a some proper thing.
 */

import { input } from "@actions-rs/core";

// Parsed action input
export interface Input {
    crate: string;
    version: string;
    useCache: boolean;
    locked: boolean;
    bins?: string[];
}

export function get(): Input {
    const crate = input.getInput("crate", { required: true });
    const version = input.getInput("version", { required: true });
    const useCache = input.getInputBool("use-cache") != false;
    const locked = input.getInputBool("locked") == true;
    const bins = splitBins(input.getInput("bins"));

    return {
        crate,
        version,
        useCache,
        locked,
        bins,
    };
}

function splitBins(bins: string | undefined): string[] | undefined {
    if (!bins) return undefined;

    return bins.split(/[\n, ]+/g);
}
