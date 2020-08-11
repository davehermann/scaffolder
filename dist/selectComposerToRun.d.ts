import { IRegisteredComposer } from "./interfaces";
/**
 * Select composer to run either via user input or configuration
 * @param foundComposers - List of "Main" composers found on the system
 */
declare function selectComposerToRun(foundComposers: Array<IRegisteredComposer>): Promise<IRegisteredComposer>;
export { selectComposerToRun as SelectComposer, };
