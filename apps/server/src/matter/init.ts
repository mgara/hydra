/**
 * Matter platform configuration — MUST be imported before any other @matter/* imports.
 *
 * ESM evaluates this module's body before sibling imports (like @matter/nodejs)
 * because it appears first in the import list of server.ts.
 */
import { config } from '@matter/nodejs/config';
import { MATTER_STORAGE_PATH } from '../config.js';

config.defaultStoragePath = MATTER_STORAGE_PATH;
config.trapProcessSignals = false; // HYDRA handles SIGINT/SIGTERM itself
