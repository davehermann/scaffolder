import { promises as fs } from "fs";
import * as path from "path";

import { Dev, Debug } from "multi-level-logger";
import { RootComposer } from "./rootComposer";
import { IRegisteredComposer, IOptions } from "./interfaces";

async function loadModule(moduleDirectory: string): Promise<any> {
    const modulePath: string = path.join(moduleDirectory, `composer.js`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loadedComposer = require(modulePath);
    return loadedComposer;
}

async function loadComposer(composerPath: string): Promise<IRegisteredComposer> {
    // Load the module
    const loadedModule = await loadModule(composerPath);

    // The module MUST export "Composer"
    if (!!loadedModule.Composer) {
        // The "Composer" export MUST inherit from the RootComposer class
        const composerInstance = new loadedModule.Composer(),
            isRootComposer = composerInstance instanceof RootComposer;

        Dev({ isRootComposer });

        // Add to the list of composers
        if (isRootComposer)
            return { name: path.basename(composerPath), path: composerPath, composer: composerInstance };
    }

    return null;
}

/** Get the directories in the path's ./composers that have a composers.js file */
async function getSubComposerDirectories(composerPath: string): Promise<Array<string>> {
    // The directory MUST have a "./composers" subdirectory
    const composersSubdirectory = (await fs.readdir(composerPath)).find(fsObjectName => (fsObjectName == `composers`)),
        // Track the modules that have composer.js
        composerModules: Array<string> = [];

    if (!!composersSubdirectory) {
        const composersRoot = path.join(composerPath, composersSubdirectory);
        // Check every object in the subdirectory
        const subComposerDirectoryContents = await fs.readdir(composersRoot);
        Dev({ subComposerDirectoryContents });
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

async function loadNamedComposerForPath(composerPath: string, composerName: string): Promise<IRegisteredComposer> {
    const composerDirectories = await getSubComposerDirectories(composerPath);

    if (composerDirectories.length > 0) {
        // Each of the directories is a possible sub-composer
        Dev({ composerDirectories });

        // Find the named composer
        const namedComposerPath = composerDirectories.find(directoryPath => (path.basename(directoryPath) == composerName));

        if (!!namedComposerPath) {
            // Load the main composer
            const namedComposer = await loadComposer(namedComposerPath);

            if (!!namedComposer)
                return namedComposer;
        }
    }

    return null;
}

/** Determine if a module is a Scaffolder composer */
async function getMainComposer(composerPath: string): Promise<IRegisteredComposer> {
    // The module directory MUST be composer-*
    if (path.basename(composerPath).search(/^composer/) == 0) {
        Debug(`Checking ${composerPath}`);

        return loadNamedComposerForPath(composerPath, `main`);
    }

    return null;
}

/** Read the globally installed NPM modules */
async function readGlobalInstalls(): Promise<Array<IRegisteredComposer>> {
    const globalPaths: Array<string> = [];

    globalPaths.push(path.join(`/`, `usr`, `lib`, `node_modules`));

    Dev({ globalPaths });

    const composerCandidates: Array<IRegisteredComposer> = [];
    for (const directory of globalPaths) {
        const fileSystemObjects = await fs.readdir(directory);
        Dev({ [`Global NPM modules`]: fileSystemObjects });

        for (let idx = 0, total = fileSystemObjects.length; idx < total; idx++) {
            const moduleDirectory = fileSystemObjects[idx],
                absoluteDirectory = path.join(directory, moduleDirectory);

            const addComposer = await getMainComposer(absoluteDirectory);
            if (addComposer)
                composerCandidates.push(addComposer);
        }

        Debug({ composerCandidates });
    }

    return composerCandidates;
}

async function findConfiguration(checkDirectory: string): Promise<IOptions> {
    Dev({ checkDirectory });

    if (checkDirectory.length > 0) {
        const fsObjects = await fs.readdir(checkDirectory);

        Dev({ fsObjects });

        if (fsObjects.indexOf(`.scaffolderrc.json`) >= 0) {
            // Read the file as JSON
            const contents = await fs.readFile(path.join(checkDirectory, `.scaffolderrc.json`), { encoding: `utf8` });
            return JSON.parse(contents);
        } else {
            // Check one path up
            const nextPath = path.dirname(checkDirectory);
            if (nextPath !== checkDirectory)
                await findConfiguration(nextPath);
        }
    }

    return undefined;
}

async function readPersistentConfiguration(): Promise<IOptions> {
    // Read up to the root directory to locate a configuration file
    const existingConfiguration = await findConfiguration(process.cwd());
    Debug({ existingConfiguration });

    return existingConfiguration;
}

export {
    readPersistentConfiguration as GetLocalConfiguration,
    readGlobalInstalls as GloballyInstalledComposers,
    loadNamedComposerForPath as LoadNamedComposer,
};
