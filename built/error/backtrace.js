const getNthOccurenceOfSubstring = (string, subString, n) => {
    return string.split(subString, n).join(subString).length;
};
class BackTrace {
    setSolContract(contract) {
        this.contract = contract;
    }
    getSolContract() {
        return this.contract;
    }
    getSourceCode(src) {
        const { contract } = this;
        const [srcStart, srcLength] = src.split(':');
        const srcEnd = Number(srcStart) + Number(srcLength);
        const srcCode = contract.slice(srcStart, srcEnd);
        const stringToStart = contract.substring(0, srcStart);
        const lineStart = stringToStart.lastIndexOf('\r\n') + 2;
        const lines = stringToStart.split('\r\n');
        const startLineNumber = lines.length;
        const lineEnd = getNthOccurenceOfSubstring(contract, '\r\n', startLineNumber);
        const line = contract.substring(lineStart, lineEnd);
        const srcStartWithinLine = Number(srcStart) - lineStart;
        const pointerLine = ' '.repeat(srcStartWithinLine) + '^'.repeat(Number(srcLength));
        console.log('line', startLineNumber);
        console.log(line);
        console.log(pointerLine);
        return [src, srcCode, startLineNumber, line, pointerLine];
    }
}
const backtrace = new BackTrace();
export default backtrace;
