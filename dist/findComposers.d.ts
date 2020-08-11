import { IRegisteredComposer } from "./interfaces";
declare function loadNamedComposerForPath(composerPath: string, composerName: string): Promise<IRegisteredComposer>;
/** Read the globally installed NPM modules */
declare function readGlobalInstalls(): Promise<Array<IRegisteredComposer>>;
export { readGlobalInstalls as GloballyInstalledComposers, loadNamedComposerForPath as LoadNamedComposer, };
