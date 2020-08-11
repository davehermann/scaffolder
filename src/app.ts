#!/usr/bin/env node

// NPM Modules
import { Err, Dev } from "multi-level-logger";

// Application Modules
import { GloballyInstalledComposers } from "./findComposers";
import { RunComposer } from "./runComposer";
import { SelectComposer } from "./selectComposerToRun";


async function initialize() {
    const foundComposers = await GloballyInstalledComposers();

    const composerToRun = await SelectComposer(foundComposers);
    Dev({ composerToRun });

    await RunComposer(composerToRun);
}

initialize()
    .catch(err => {
        Err(err);
    });
