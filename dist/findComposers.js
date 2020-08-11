"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GloballyInstalledComposers = void 0;
const fs_1 = require("fs");
const path = require("path");
const multi_level_logger_1 = require("multi-level-logger");
const rootComposer_1 = require("./rootComposer");
async function loadModule(moduleDirectory) {
    const modulePath = path.join(moduleDirectory, `composer.js`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loadedComposer = require(modulePath);
    return loadedComposer;
}
async function loadComposer(composerPath) {
    // Load the module
    const loadedModule = await loadModule(composerPath);
    // The module MUST export "Composer"
    if (!!loadedModule.Composer) {
        // The "Composer" export MUST inherit from the RootComposer class
        const composerInstance = new loadedModule.Composer(), isRootComposer = composerInstance instanceof rootComposer_1.RootComposer;
        multi_level_logger_1.Dev({ isRootComposer });
        // Add to the list of composers
        if (isRootComposer)
            return { name: path.basename(composerPath), path: composerPath, composer: composerInstance };
    }
    return null;
}
/** Get the directories in the path's ./composers that have a composers.js file */
async function getSubComposerDirectories(composerPath) {
    // The directory MUST have a "./composers" subdirectory
    const composersSubdirectory = (await fs_1.promises.readdir(composerPath)).find(fsObjectName => (fsObjectName == `composers`)), 
    // Track the modules that have composer.js
    composerModules = [];
    if (!!composersSubdirectory) {
        const composersRoot = path.join(composerPath, composersSubdirectory);
        // Check every object in the subdirectory
        const subComposerDirectoryContents = await fs_1.promises.readdir(composersRoot);
        multi_level_logger_1.Dev({ subComposerDirectoryContents });
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
async function getMainComposer(composerPath) {
    // The module directory MUST be composer-*
    if (path.basename(composerPath).search(/^composer/) == 0) {
        multi_level_logger_1.Debug(`Checking ${composerPath}`);
        const composerDirectories = await getSubComposerDirectories(composerPath);
        if (composerDirectories.length > 0) {
            // Each of the directories is a possible sub-composer
            multi_level_logger_1.Dev({ composerDirectories });
            // For this to be a composer, one directory MUST be "main"
            const mainComposerPath = composerDirectories.find(directoryPath => (path.basename(directoryPath) == `main`));
            if (!!mainComposerPath) {
                // Load the main composer
                const mainComposer = await loadComposer(mainComposerPath);
                if (!!mainComposer)
                    return mainComposer;
            }
        }
    }
    return null;
}
/** Read the globally installed NPM modules */
async function readGlobalInstalls() {
    const globalPaths = [];
    globalPaths.push(path.join(`/`, `usr`, `lib`, `node_modules`));
    multi_level_logger_1.Dev({ globalPaths });
    const composerCandidates = [];
    for (const directory of globalPaths) {
        const fileSystemObjects = await fs_1.promises.readdir(directory);
        multi_level_logger_1.Dev({ [`Global NPM modules`]: fileSystemObjects });
        for (let idx = 0, total = fileSystemObjects.length; idx < total; idx++) {
            const moduleDirectory = fileSystemObjects[idx], absoluteDirectory = path.join(directory, moduleDirectory);
            const addComposer = await getMainComposer(absoluteDirectory);
            if (addComposer)
                composerCandidates.push(addComposer);
        }
        multi_level_logger_1.Debug({ composerCandidates });
    }
    return composerCandidates;
}
exports.GloballyInstalledComposers = readGlobalInstalls;
