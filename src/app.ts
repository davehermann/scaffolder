#!/usr/bin/env node

// NPM Modules
import { Err, Dev } from "multi-level-logger";

// Application Modules
import { GloballyInstalledComposers, GetLocalConfiguration } from "./findComposers";
import { RunComposer } from "./runComposer";
import { SelectComposer } from "./selectComposerToRun";


async function initialize() {
    const existingConfiguration = await GetLocalConfiguration();
    const foundComposers = await GloballyInstalledComposers();

    const composerToRun = await SelectComposer(foundComposers, existingConfiguration);
    Dev({ composerToRun });

    await RunComposer(composerToRun.registeredComposer, existingConfiguration, composerToRun.name);
}

initialize()
    .catch(err => {
        Err(err);
    });
