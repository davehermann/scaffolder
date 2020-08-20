#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
// Application Modules
const findComposers_1 = require("./findComposers");
const runComposer_1 = require("./runComposer");
const selectComposerToRun_1 = require("./selectComposerToRun");
async function initialize() {
    const existingConfiguration = await findComposers_1.GetLocalConfiguration();
    const foundComposers = await findComposers_1.GloballyInstalledComposers();
    const composerToRun = await selectComposerToRun_1.SelectComposer(foundComposers, existingConfiguration);
    multi_level_logger_1.Dev({ composerToRun });
    await runComposer_1.RunComposer(composerToRun.registeredComposer, existingConfiguration, composerToRun.name);
}
initialize()
    .catch(err => {
    multi_level_logger_1.Err(err);
});
