import winston from "winston";
import path from "path";

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack || ""}`;
    })
);

const colorizedFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack || ""}`;
    })
);

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: logFormat,
    transports: [
        new winston.transports.File({
            filename: path.join("logs", "combined.log"),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.Console({
            format: colorizedFormat,
        }),
    ],
    exceptionHandlers: [new winston.transports.File({ filename: path.join("logs", "exceptions.log") })],
    rejectionHandlers: [new winston.transports.File({ filename: path.join("logs", "rejections.log") })],
});

try {
    require("fs").mkdirSync("logs");
} catch (e) {
    // Directory already exists
}

export default logger;
