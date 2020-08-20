import { IRegisteredComposer, ISelectedComposer, IOptions } from "./interfaces";
/**
 * Get the root path from a sub-composer
 * @param composerPath - Path for a sub-composer
 * */
declare function getComposerRoot(composerPath: string): string;
/**
 * Select composer to run either via user input or configuration
 * @param foundComposers - List of "Main" composers found on the system
 */
declare function selectComposerToRun(foundComposers: Array<IRegisteredComposer>, existingConfiguration: IOptions): Promise<ISelectedComposer>;
export { getComposerRoot as GetComposerRoot, selectComposerToRun as SelectComposer, };
