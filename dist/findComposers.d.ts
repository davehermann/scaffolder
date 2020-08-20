import { IRegisteredComposer, IOptions } from "./interfaces";
declare function loadNamedComposerForPath(composerPath: string, composerName: string): Promise<IRegisteredComposer>;
/** Read the globally installed NPM modules */
declare function readGlobalInstalls(): Promise<Array<IRegisteredComposer>>;
declare function readPersistentConfiguration(): Promise<IOptions>;
export { readPersistentConfiguration as GetLocalConfiguration, readGlobalInstalls as GloballyInstalledComposers, loadNamedComposerForPath as LoadNamedComposer, };
