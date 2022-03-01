/*
  Pulled from https://github.com/winstonjs/winston/issues/1427 with some edits.
*/
import winston from 'winston';
import util from 'util';
import config from 'config';
const { createLogger, format, transports } = winston;
const { inspect } = util;
function formatWithInspect(val) {
    return `${val instanceof Object ? '\n' : ''} ${inspect(val, {
        depth: null,
        colors: true,
    })}`;
}
export default createLogger({
    level: config.get('log_level') || 'info',
    format: winston.format.combine(format.errors({ stack: true }), format.colorize(), format.printf(info => {
        const index = Symbol.for('splat'); // fix for ts compiler: https://github.com/Microsoft/TypeScript/issues/24587#issuecomment-460650063
        const splatArgs = info[index];
        let log = `${info.level}: ${info.message}`;
        // append splat messages to log
        if (splatArgs) {
            const rest = splatArgs.map(formatWithInspect).join();
            log += ` ${rest}`;
        }
        // check if error log, if so append error stack
        if (info.stack) {
            log += ` ${info.stack}`;
        }
        return log;
    })),
    transports: [new transports.Console()],
});
