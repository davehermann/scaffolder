import { IRegisteredComposer } from "./interfaces";
/** Read the globally installed NPM modules */
declare function readGlobalInstalls(): Promise<Array<IRegisteredComposer>>;
export { readGlobalInstalls as GloballyInstalledComposers, };
