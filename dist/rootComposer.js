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
const textextensions_1 = require("textextensions");
const binaryextensions_1 = require("binaryextensions");
class RootComposer {
    /**
     * @param composerDirectory - Pass in **__dirname** from the composer
     */
    constructor(subclassDirectory) {
        this.subclassDirectory = subclassDirectory;
        /** This composer configures other composers, and does not compose templates */
        this.passthroughOnly = false;
        /** Configuration should be persisted to disk when writing initial configuration */
        this.persistConfiguration = false;
        if (!subclassDirectory)
            throw new Error(`RootComposer requires subclasses to call super(__dirname) in their constructor`);
        this.enabled = true;
    }
    /** Override to provide questions for the child composer */
    Questions({ answers }) {
        return [];
    }
    /** Display any questions for this composer to the user */
    async AskQuestions({ answers }) {
        const questions = this.Questions({ answers });
        const promptAnswers = await inquirer.prompt(questions);
        return promptAnswers;
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
    getPathToTemplate(existingTemplates, filePath, { answers, configuration }) {
        if (existingTemplates.has(filePath))
            return filePath;
        // Pass through InstallPath if the file path isn't found
        const installPath = this.InstallPath(filePath, { answers, configuration });
        if (existingTemplates.has(installPath))
            return installPath;
        throw new Error(`No template for "${filePath}" or "${installPath}" found`);
    }
    /**
     * Utility to drop templates
     * @param filesToRemove - file names will be automatically passed through **InstallPath** if not directly in template map
     */
    RemoveFromTemplates(filesToRemove, existingTemplates, { answers, configuration }) {
        if (typeof filesToRemove == `string`)
            filesToRemove = [filesToRemove];
        filesToRemove.forEach(filePath => {
            existingTemplates.delete(this.getPathToTemplate(existingTemplates, filePath, { answers, configuration }));
        });
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
                multi_level_logger_1.Dev({ fullId, source, directives, root, props });
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
                        case `lowercase`:
                            if (!!value)
                                value = value.toLowerCase();
                            break;
                        case `replace`:
                            if (!!value) {
                                const [original, update] = data.split(`;`);
                                value = value.replace(original, update);
                            }
                            break;
                        case `substr`:
                            if (!!value)
                                value = value.substr(+data);
                            break;
                    }
                });
                if (value !== undefined)
                    fileContents = fileContents.replace(fullId, value);
            });
        return fileContents;
    }
    ReplaceToken(existingTemplates, templatePath, token, replacement, { answers, configuration }) {
        const pathInTemplate = this.getPathToTemplate(existingTemplates, templatePath, { answers, configuration });
        const loadedFileContents = existingTemplates.get(pathInTemplate);
        const replacementId = new RegExp(`\\$\\$\\$${token}\\$\\$\\$`);
        const updatedFileContents = loadedFileContents.replace(replacementId, replacement);
        existingTemplates.set(pathInTemplate, updatedFileContents);
    }
    isBinaryFile(filePath) {
        const extension = path.extname(filePath);
        // A dot file (e.g. .gitignore) or no extension will have no length
        // Assume as text file
        if (extension.length == 0)
            return false;
        if (binaryextensions_1.default.indexOf(extension.substr(1)) >= 0)
            return true;
        if (textextensions_1.default.indexOf(extension.substr(1)) >= 0)
            return false;
        // Default to null for anything that can't be determined
        return null;
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
            const fullPathToFile = path.join(this.subclassDirectory, `templates`, filePath);
            const isBinaryFile = this.isBinaryFile(fullPathToFile);
            // For now, read all non-binary as utf8, including indeterminates
            const contents = await fs_1.promises.readFile(fullPathToFile, { encoding: isBinaryFile ? `base64` : `utf8` });
            templateFiles.set(this.InstallPath(filePath, { answers, configuration }), this.replaceTemplateTokens(contents, { answers, configuration }));
        }
        await this.TemplateFileAdjustments(templateFiles, { answers, configuration });
        return templateFiles;
    }
    /** Modify loaded templates, and load/remove from templates */
    async TemplateFileAdjustments(existingTemplates, { answers, configuration }) {
        return null;
    }
    InstallDependencies({ answers, configuration }) {
        return { runtime: null, development: null };
    }
    PostInstallTasks({ answers, configuration }) {
        return [];
    }
    AdditionalCompositions({ answers, configuration }) {
        return [];
    }
}
exports.RootComposer = RootComposer;
