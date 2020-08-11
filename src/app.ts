#!/usr/bin/env node

import { promises as fs } from "fs";
import * as path from "path";

import { InitializeLogging, Err, Dev, Debug } from "multi-level-logger";

async function getSubComposerDirectories(composerPath: string): Promise<Array<string>> {
    // The directory MUST have a "./composers" subdirectory
    const composersSubdirectory = (await fs.readdir(composerPath)).find(fsObjectName => (fsObjectName == `composers`)),
        // Track the modules that have composer.js
        composerModules: Array<string> = [];

    if (!!composersSubdirectory) {
        const composersRoot = path.join(composerPath, composersSubdirectory);
        // Check every object in the subdirectory
        const subComposerDirectoryContents = await fs.readdir(composersRoot);
        for (let idx = 0, total = subComposerDirectoryContents.length; idx < total; idx++) {
            const composerFsObjectPath = path.join(composersRoot, subComposerDirectoryContents[idx]);
            const stats = await fs.stat(composerFsObjectPath);

            // For each directory
            if (stats.isDirectory()) {
                // If the directory contains a "composer.js" file, add it to the array
                const hasComposersJs = !!(await fs.readdir(composerFsObjectPath)).find(fsObjectName => (fsObjectName == `composer.js`));

                if (hasComposersJs)
                    composerModules.push(composerFsObjectPath);
            }
        }
    }

    return composerModules;
}

/** Determine if a module is a Scaffolder composer */
async function isComposer(composerPath: string): Promise<boolean> {
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
    const globalPaths: Array<string> = [];

    globalPaths.push(path.join(`/`, `usr`, `lib`, `node_modules`));

    const composerCandidates: Array<string> = [];
    for (const directory of globalPaths) {
        const fileSystemObjects = await fs.readdir(directory);
        Dev({ fileSystemObjects });

        for (let idx = 0, total = fileSystemObjects.length; idx < total; idx++) {
            const moduleDirectory = fileSystemObjects[idx],
                absoluteDirectory = path.join(directory, moduleDirectory);

            const addComposer = await isComposer(absoluteDirectory);
            if (addComposer)
                composerCandidates.push(absoluteDirectory);
        }

        Debug({ composerCandidates });
    }
}

async function initialize() {
    await readGlobalInstalls();
}

InitializeLogging(`debug`);
initialize()
    .catch(err => {
        Err(err);
    });
