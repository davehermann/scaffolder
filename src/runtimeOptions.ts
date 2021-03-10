const installDependencies = (process.env.NO_NPM === undefined ? true : (process.env.NO_NPM !== `true`));
const addToGit = (process.env.NO_GIT === undefined ? true : (process.env.NO_GIT !== `true`));

function DisplayOptions(): void {
    const isActive = `\x1b[32m`, // Green
        isInactive = ``, //`\x1b[31m`, // Red
        bold = `\x1b[1m`,
        reset = `\x1b[0m`;

    // eslint-disable-next-line no-console
    console.log(`${bold}-- Available Environment Flags --${reset}`);
    // eslint-disable-next-line no-console
    console.log(`\t${!installDependencies ? isActive : isInactive}NO_NPM=true${reset}\t- Do not install dependencies`);
    // eslint-disable-next-line no-console
    console.log(`\t${!addToGit ? isActive : isInactive}NO_GIT=true${reset}\t- Do not automatically commit to a git repo upon completion\n`);
}

export {
    installDependencies as INSTALL_DEPENDENCIES,
    addToGit as ADD_TO_GIT,
    DisplayOptions,
};
