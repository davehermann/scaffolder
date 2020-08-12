"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootComposer = void 0;
// Node Modules
const fs_1 = require("fs");
const path = require("path");
// NPM Modules
const fs_utilities_1 = require("@davehermann/fs-utilities");
const inquirer = require("inquirer");
const multi_level_logger_1 = require("multi-level-logger");
class RootComposer {
    /**
     * @param composerDirectory - Pass in **__dirname** from the composer
     */
    constructor(subclassDirectory) {
        this.subclassDirectory = subclassDirectory;
        /** This composer configures other composers, and does not compose templates */
        this.passthroughOnly = false;
        if (!subclassDirectory)
            throw `RootComposer requires subclasses to call super(__dirname)`;
        this.enabled = true;
    }
    /** Override to provide questions for the child composer */
    Questions({ answers }) {
        return [];
    }
    /** Display any questions for this composer to the user */
    async AskQuestions({ answers }) {
        const questions = this.Questions({ answers });
        if (questions.length > 0) {
            const answers = await inquirer.prompt(questions);
            return answers;
        }
        return null;
    }
    /**
     * Override to provide configuration settings
     *   - Set **configuration.installDestination** in your main composer to your newly created path
     */
    SetConfiguration({ answers, configuration }) {
        if (!configuration.installDestination && !this.passthroughOnly)
            throw `configuration.installDestination must be specified in a SetConfiguration() override in your composer`;
    }
    /** Override to inject directory structure or file renaming into the path */
    InstallPath(filePath, { answers, configuration }) {
        return filePath;
    }
    async AddFileOnDiskToTemplates(filePath, existingTemplates, { configuration }) {
        // Load the file into the templates
        if (!existingTemplates.has(filePath)) {
            // Read the existing file
            const contents = await fs_1.promises.readFile(path.join(configuration.installDestination, filePath), { encoding: `utf8` });
            existingTemplates.set(filePath, contents);
        }
    }
    getDirectoryFiles(directoryRoot, foundFiles = []) {
        while (directoryRoot.items.length > 0) {
            const nextItem = directoryRoot.items.shift();
            if (nextItem.isDirectory)
                this.getDirectoryFiles(nextItem, foundFiles);
            else
                foundFiles.push(nextItem.objectPath);
        }
        return foundFiles;
    }
    replaceTemplateTokens(fileContents, { answers, configuration }) {
        const replacements = fileContents.match(/\$\$\$(\w+\.?)+(\/(\w+(:[@\w]+)*[,;]?)+)*\$\$\$/g);
        if (!!replacements)
            replacements.forEach(fullId => {
                const replacementId = fullId.substr(3, fullId.length - 6);
                const [source, ...directives] = replacementId.split(`/`);
                const [root, ...props] = source.split(`.`);
                multi_level_logger_1.Dev({ source, directives, root, props });
                let value;
                // Non-standard roots must be implemented in each composer
                switch (root) {
                    case `answers`:
                        value = answers;
                        break;
                    case `configuration`:
                        value = configuration;
                        break;
                }
                while ((props.length > 0) && !!value)
                    value = value[props.shift()];
                multi_level_logger_1.Dev({ value });
                directives.forEach(directive => {
                    const [action, data] = directive.split(`:`);
                    switch (action) {
                        case `default`:
                            if (!value)
                                value = data;
                            break;
                        case `substr`:
                            if (!!value)
                                value = value.substr(+data);
                            break;
                        case `replace`:
                            if (!!value) {
                                const [original, update] = data.split(`;`);
                                value = value.replace(original, update);
                            }
                            break;
                    }
                });
                if (value !== undefined)
                    fileContents = fileContents.replace(fullId, value);
            });
        return fileContents;
    }
    async GetTemplateFiles({ answers, configuration }) {
        let templateFilenames = [];
        // Read the files within the path
        const fsContents = await fs_utilities_1.ReadSubDirectories(this.subclassDirectory);
        // Find the templates
        const templateDir = fsContents.find(fsItem => (fsItem.fsName == `templates`));
        if (!!templateDir)
            templateFilenames = this.getDirectoryFiles(templateDir).map(filePath => filePath.replace(`${templateDir.objectPath}${path.sep}`, ``));
        multi_level_logger_1.Dev(templateFilenames);
        const templateFiles = new Map();
        while (templateFilenames.length > 0) {
            const filePath = templateFilenames.shift();
            // Read the file
            const contents = await fs_1.promises.readFile(path.join(this.subclassDirectory, `templates`, filePath), { encoding: `utf8` });
            templateFiles.set(this.InstallPath(filePath, { answers, configuration }), this.replaceTemplateTokens(contents, { answers, configuration }));
        }
        this.TemplateFileAdjustments(templateFiles, { answers, configuration });
        return templateFiles;
    }
    TemplateFileAdjustments(templates, { answers, configuration }) {
        return null;
    }
    async FileChanges(existingTemplates, { answers, configuration }) {
        return null;
    }
    InstallDependencies({ answers, configuration }) {
        return { runtime: null, development: null };
    }
    AdditionalCompositions({ answers, configuration }) {
        return [];
    }
}
exports.RootComposer = RootComposer;
