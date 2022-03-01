/**
Module to set up zkp elements of compiler output, along with writing the vks to the db folder. To be run from inside the zokrates container.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from 'fs';
import yargs from 'yargs';
import { generateKeys } from './zokrates.mjs';
// const { generalise } = GN;
const { argv } = yargs.usage('Usage: $0 -i <input file>').demandOption(['i']);
const functionPath = `/app/examples/cases/uninit_global`;
export const setup = (functionName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!fs.existsSync(`/app/circuits/${functionName}.zok`)) {
        const circuit = fs.readFileSync(`${functionPath}/${functionName}.zok`, 'utf-8');
        fs.writeFileSync(`/app/circuits/${functionName}.zok`, circuit);
    }
    yield generateKeys(`${functionName}.zok`);
});
setup(argv.i);
