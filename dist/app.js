#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
// Application Modules
const findComposers_1 = require("./findComposers");
const selectComposerToRun_1 = require("./selectComposerToRun");
async function initialize() {
    const foundComposers = await findComposers_1.GloballyInstalledComposers();
    const runComposer = await selectComposerToRun_1.SelectComposer(foundComposers);
    multi_level_logger_1.Dev({ runComposer });
}
initialize()
    .catch(err => {
    multi_level_logger_1.Err(err);
});
