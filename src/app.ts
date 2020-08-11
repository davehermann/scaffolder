#!/usr/bin/env node

// NPM Modules
import { Err, Dev } from "multi-level-logger";

// Application Modules
import { GloballyInstalledComposers } from "./findComposers";
import { SelectComposer } from "./selectComposerToRun";


async function initialize() {
    const foundComposers = await GloballyInstalledComposers();

    const runComposer = await SelectComposer(foundComposers);
    Dev({ runComposer });
}

initialize()
    .catch(err => {
        Err(err);
    });
