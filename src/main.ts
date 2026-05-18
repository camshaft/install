import * as io from "@actions/io";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as cache from "@actions/cache";
import { Cargo, resolveVersion } from "@actions-rs/core";
import * as path from "path";

import * as input from "./input";

interface Options {
    useCache: boolean;
    locked: boolean;
    bins?: string[];
}

interface InstallCachedOptions {
    bins?: string[];
    restoreKeys?: string[];
    locked: boolean;
}

export async function run(
    crate: string,
    version: string,
    options: Options
): Promise<void> {
    core.info(`Installing ${crate} with cargo`);
    const cargo = await Cargo.get();
    const key = options.useCache ? await getRustKey() : "";
    await installCached(cargo, crate, version, key, {
        bins: options.bins,
        locked: options.locked,
    });
}

async function installCached(
    cargo: Cargo,
    crate: string,
    version?: string,
    primaryKey?: string,
    options: InstallCachedOptions = { locked: false }
): Promise<string> {
    if (version == "latest") {
        version = await resolveVersion(crate);
    }
    const { bins, restoreKeys, locked } = options;
    if (primaryKey) {
        const resolvedRestoreKeys = restoreKeys || [];
        const installDir = await io.which("cargo", true);
        const paths = (bins || [crate]).map((bin) =>
            path.join(path.dirname(installDir), bin)
        );
        const lockedSuffix = locked ? "-locked" : "";
        const programKey = crate + "-" + version + lockedSuffix + "-" + primaryKey;
        const programRestoreKeys = resolvedRestoreKeys.map(
            (key) => crate + "-" + version + lockedSuffix + "-" + key
        );
        const cacheKey = await cache.restoreCache(
            paths,
            programKey,
            programRestoreKeys
        );
        if (cacheKey) {
            core.info(`Using cached \`${crate}\` with version ${version}`);
            return crate;
        } else {
            const res = await install(cargo, crate, bins, version, locked);
            try {
                core.info(`Caching \`${crate}\` with key ${programKey}`);
                await cache.saveCache(paths, programKey);
            } catch (error) {
                if (error.name === cache.ValidationError.name) {
                    throw error;
                } else if (error.name === cache.ReserveCacheError.name) {
                    core.info(error.message);
                } else {
                    core.info("[warning]" + error.message);
                }
            }
            return res;
        }
    } else {
        return await install(cargo, crate, bins, version, locked);
    }
}

async function install(
    cargo: Cargo,
    crate: string,
    bins?: string[],
    version?: string,
    locked?: boolean
): Promise<string> {
    const args = ["install"];
    if (version && version != "latest") {
        args.push("--version");
        args.push(version);
    }
    if (locked) {
        args.push("--locked");
    }
    if (bins) {
        bins.forEach((bin) => {
            args.push("--bin");
            args.push(bin);
        });
    }
    args.push(crate);

    try {
        core.startGroup(`Installing "${crate} = ${version || "latest"}"`);
        await cargo.call(args);
    } finally {
        core.endGroup();
    }

    return crate;
}

async function getRustKey(): Promise<string> {
    const rustc = await getRustVersion();
    return `${rustc.release}-${rustc.host}-${rustc["commit-hash"].slice(
        0,
        12
    )}`;
}

interface RustVersion {
    host: string;
    release: string;
    "commit-hash": string;
}

async function getRustVersion(): Promise<RustVersion> {
    const stdout = await getCmdOutput("rustc", ["-vV"]);
    let splits = stdout
        .split(/[\n\r]+/)
        .filter(Boolean)
        .map((s) => s.split(":").map((s) => s.trim()))
        .filter((s) => s.length === 2);
    return Object.fromEntries(splits);
}

export async function getCmdOutput(
    cmd: string,
    args: Array<string> = []
): Promise<string> {
    let stdout = "";
    await exec.exec(cmd, args, {
        silent: true,
        listeners: {
            stdout(data) {
                stdout += data.toString();
            },
        },
    });
    return stdout;
}

async function main(): Promise<void> {
    try {
        const actionInput = input.get();

        await run(actionInput.crate, actionInput.version, {
            useCache: actionInput.useCache,
            locked: actionInput.locked,
            bins: actionInput.bins,
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
