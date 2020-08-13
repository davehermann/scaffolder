// Node Modules
import * as path from "path";

// NPM Modules
import * as inquirer from "inquirer";
import { Dev, Trace, Debug } from "multi-level-logger";

// Application Modules
import { IRegisteredComposer } from "./interfaces";

/** Get the name of each found composer, and let the user select one */
async function displayPromptToUser(composerNames: Array<{ name: string, composer: IRegisteredComposer}>) {
    Trace({ composerNames });

    // Display as a choice
    const prompt: inquirer.QuestionCollection = [
        { type: `list`, name: `selectedComposer`, message: `Available composers`, choices: composerNames.map(c => c.name) }
    ];

    const answers = await inquirer.prompt(prompt);
    Debug({ answers });

    return composerNames.find(cN => (cN.name == answers.selectedComposer)).composer;
}

/**
 * Get the root path from a sub-composer
 * @param composerPath - Path for a sub-composer
 * */
function getComposerRoot(composerPath: string): string {
    const pathArrayForComposer = composerPath.split(path.sep);
    return pathArrayForComposer.slice(0, pathArrayForComposer.length - 2).join(path.sep);
}

/**
 * Select composer to run either via user input or configuration
 * @param foundComposers - List of "Main" composers found on the system
 */
async function selectComposerToRun(foundComposers: Array<IRegisteredComposer>): Promise<IRegisteredComposer> {
    // No composer produces an error
    if (foundComposers.length == 0)
        throw `No configured Composers found`;

    // Map the composer directory name to the composer object
    const composerNames = foundComposers.map(composer => {
        const pathToComposerRoot = getComposerRoot(composer.path);
        Dev({ pathToComposerRoot });

        return { name: path.basename(pathToComposerRoot).replace(/^composer-/, ``), composer };
    });

    // A configuration file located anywhere up the path tree from the current working directory will auto-select the composer
    // A parameter used in the CLI command will auto-select the composer

    const selected = await displayPromptToUser(composerNames);

    return selected;
}

export {
    getComposerRoot as GetComposerRoot,
    selectComposerToRun as SelectComposer,
};
