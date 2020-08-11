#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
const multi_level_logger_1 = require("multi-level-logger");
async function getSubComposerDirectories(composerPath) {
    // The directory MUST have a "./composers" subdirectory
    const composersSubdirectory = (await fs_1.promises.readdir(composerPath)).find(fsObjectName => (fsObjectName == `composers`)), 
    // Track the modules that have composer.js
    composerModules = [];
    if (!!composersSubdirectory) {
        const composersRoot = path.join(composerPath, composersSubdirectory);
        // Check every object in the subdirectory
        const subComposerDirectoryContents = await fs_1.promises.readdir(composersRoot);
        for (let idx = 0, total = subComposerDirectoryContents.length; idx < total; idx++) {
            const composerFsObjectPath = path.join(composersRoot, subComposerDirectoryContents[idx]);
            const stats = await fs_1.promises.stat(composerFsObjectPath);
            // For each directory
            if (stats.isDirectory()) {
                // If the directory contains a "composer.js" file, add it to the array
                const hasComposersJs = !!(await fs_1.promises.readdir(composerFsObjectPath)).find(fsObjectName => (fsObjectName == `composer.js`));
                if (hasComposersJs)
                    composerModules.push(composerFsObjectPath);
            }
        }
    }
    return composerModules;
}
/** Determine if a module is a Scaffolder composer */
async function isComposer(composerPath) {
    // The module directory MUST be composer-*
    if (path.basename(composerPath).search(/^composer/) == 0) {
        const composerDirectories = await getSubComposerDirectories(composerPath);
        if (composerDirectories.length > 0) {
            // Each of the directories is a possible sub-composer
            // For this to be a composer, one directory MUST be "main"
            // Load the module
            // The module MUST export "Composer"
            // The "Composer" export MUST inherit from the RootComposer class
            // Add to the list of composers
            return true;
        }
    }
    return false;
}
/** Read the globally installed NPM modules */
async function readGlobalInstalls() {
    const globalPaths = [];
    globalPaths.push(path.join(`/`, `usr`, `lib`, `node_modules`));
    const composerCandidates = [];
    for (const directory of globalPaths) {
        const fileSystemObjects = await fs_1.promises.readdir(directory);
        multi_level_logger_1.Dev({ fileSystemObjects });
        for (let idx = 0, total = fileSystemObjects.length; idx < total; idx++) {
            const moduleDirectory = fileSystemObjects[idx], absoluteDirectory = path.join(directory, moduleDirectory);
            const addComposer = await isComposer(absoluteDirectory);
            if (addComposer)
                composerCandidates.push(absoluteDirectory);
        }
        multi_level_logger_1.Debug({ composerCandidates });
    }
}
async function initialize() {
    await readGlobalInstalls();
}
multi_level_logger_1.InitializeLogging(`debug`);
initialize()
    .catch(err => {
    multi_level_logger_1.Err(err);
});
