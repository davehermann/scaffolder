"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectComposer = exports.GetComposerRoot = void 0;
// Node Modules
const path = require("path");
// NPM Modules
const inquirer = require("inquirer");
const multi_level_logger_1 = require("multi-level-logger");
/** Get the name of each found composer, and let the user select one */
async function displayPromptToUser(composerNames) {
    multi_level_logger_1.Trace({ composerNames });
    // Display as a choice
    const prompt = [
        { type: `list`, name: `selectedComposer`, message: `Available composers`, choices: composerNames.map(c => c.name) }
    ];
    const answers = await inquirer.prompt(prompt);
    multi_level_logger_1.Debug({ answers });
    return answers.selectedComposer;
}
/**
 * Get the root path from a sub-composer
 * @param composerPath - Path for a sub-composer
 * */
function getComposerRoot(composerPath) {
    const pathArrayForComposer = composerPath.split(path.sep);
    return pathArrayForComposer.slice(0, pathArrayForComposer.length - 2).join(path.sep);
}
exports.GetComposerRoot = getComposerRoot;
/**
 * Select composer to run either via user input or configuration
 * @param foundComposers - List of "Main" composers found on the system
 */
async function selectComposerToRun(foundComposers, existingConfiguration) {
    // No composer produces an error
    if (foundComposers.length == 0)
        throw `No configured Composers found`;
    // Map the composer directory name to the composer object
    const composerNames = foundComposers.map(composer => {
        const pathToComposerRoot = getComposerRoot(composer.path);
        multi_level_logger_1.Dev({ pathToComposerRoot });
        return { name: path.basename(pathToComposerRoot).replace(/^composer-/, ``), composer };
    });
    let selectedComposer;
    // An environment variable used in the CLI command will auto-select the composer, and override any configuration
    if (!!process.env.COMPOSER)
        selectedComposer = process.env.COMPOSER;
    else if (!!existingConfiguration && !!existingConfiguration.composer)
        // A configuration file located anywhere up the path tree from the current working directory will auto-select the composer
        selectedComposer = existingConfiguration.composer;
    else
        selectedComposer = await displayPromptToUser(composerNames);
    return { name: selectedComposer, registeredComposer: composerNames.find(cN => (cN.name == selectedComposer)).composer };
}
exports.SelectComposer = selectComposerToRun;
