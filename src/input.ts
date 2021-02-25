/**
 * Parse action input into a some proper thing.
 */

import { input } from "@actions-rs/core";

// Parsed action input
export interface Input {
    crate: string;
    version: string;
    useCache: boolean;
    bins?: string[];
}

export function get(): Input {
    const crate = input.getInput("crate", { required: true });
    const version = input.getInput("version", { required: true });
    const useCache = input.getInputBool("use-cache") != false;
    const bins = splitBins(input.getInput("bins"));

    return {
        crate,
        version,
        useCache,
        bins,
    };
}

function splitBins(bins: string | undefined): string[] | undefined {
    if (!bins) return undefined;

    return bins.split(/[\n, ]+/g);
}
