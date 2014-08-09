/**
 * Created by stephen on 27/01/2014.
 *
 * Updated by Stephen on 09/09/2014.
 * Added additional mail-listerner2 1.7.0 parameters.
 * Changed the default config directory and env variable
 * Auto create the attachments directory if not available
 * Added some debug
 * ---
 *
 */

//START of variable declarations
var MailListener = require('mail-listener2')
    , IMAPcredentials = require('./IMAPconfig.js')
    , fs = require('fs')
    , net = require('net')
    , configFile = 'imap_socket_ewe.conf'
    , data = ''
    , moogMsg = {}
    , config = {
        IMAPConf: {
            imap: {
                host: 'imap.gmail.com',
                port: 993,
                secure: true,
                mailbox: 'INBOX',
                markseen: true,
                loadUnreadOnStart: false,
                streamAttachments: false,
                loadAttachments: false,
                attachmentsDir: 'attachments/'
            }
        },
        moogConf: {
            host: 'localhost',
            outPort: 8415,
            type: 'J',
            delim: '||',
            prefix: 'MOOMAIL: '
        },
        nodeConf: {
            logLevel: 'WARN',
            heartbeat: true,
            heartbeatBeat: 10000,
            monitorName: 'imap_socket_ewe',
            closeTW: false,
            retryTW: 10,
            retryStream: 10
        }
    }
    , stream = {}
    , logL = {ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3}
    , beatCount = 0
    , maxVal = 0
    , minVal = config.nodeConf.heartbeatBeat
    , totVal = 0
    , logLevel = 'INFO'
    ;
var mailListener = new MailListener({
    username: IMAPcredentials.username,
    password: IMAPcredentials.password,
    host: config.IMAPConf.imap.host,
    port: config.IMAPConf.imap.port,
    tls: config.IMAPConf.imap.secure,
    tlsOptions: { rejectUnauthorized: false },
    mailbox: config.IMAPConf.imap.mailbox, // mailbox to monitor
    markSeen: config.IMAPConf.imap.markseen, // all fetched email willbe marked as seen and not fetched next time
    fetchUnreadOnStart: config.IMAPConf.imap.loadUnreadOnStart, // use it only if you want to get all unread email on lib start. Default is `false`
    mailParserOptions: {streamAttachments: config.IMAPConf.imap.streamAttachments}, // options to be passed to mailParser lib. 
    attachments: config.IMAPConf.imap.loadAttachments, // download attachments as they are encountered to the project directory
    attachmentOptions: { directory: config.IMAPConf.imap.attachmentsDir } // specify a download directory for attachments
});

console.log('[START:] [' + Date() + '] IMAP - Incident.MOOG Interface Node.js module');
console.log('[START:] [' + Date() + '] Current directory: ' + process.cwd());

if (!process.env.MOOGSOFT_HOME_NODE) {
    logger('MOOGSOFT_HOME_NODE Environment variable not set, using local config.', logL.WARN);
} else {
    configFile = process.env.MOOGSOFT_HOME_NODE + '/config/' + configFile;
}
try {
    data = fs.readFileSync(configFile, 'utf8');
}
catch (err) {
    logger('Configuration file read error!: ' + configFile, logL.ERROR);
}
if (!data) {
    data = config;
    logLevel = getLogLevel(config.nodeConf.logLevel);
    logger('Default Config File Created: ', logL.WARN);
    writeFile();
}
else {
    config = JSON.parse(data);
    logLevel = getLogLevel(config.nodeConf.logLevel);
    logger('Default Config File Read: ' + configFile, logL.INFO);
}

try {
    fs.mkdirSync(config.IMAPConf.imap.attachmentsDir);
}
catch (err) {
    if (err.message.indexOf('EXIST')) {
        logger('Attachments directory exists, continuing', logL.INFO);
    } else {
        logger('Error creating attachment directory: ' + err, logL.ERROR);
    }
}
stream = net.connect(config.moogConf.outPort, config.moogConf.host, function () {
        logger('IMAP Event Stream Connected', logL.INFO);
        mailListener.start(); // start listening
    }
);

mailListener.on("mail", function (mail) {
    processEv(mail);
});

mailListener.on("server:connected", function () {
    logger("imapConnected", logL.INFO);
});

mailListener.on("server:disconnected", function () {
    logger("imapDisconnected", logL.INFO);
});

mailListener.on("error", function (err) {
    logger('Mail Listener: ' + err, logL.ERROR);
    logger(err.source, logL.DEBUG);
    terminate();
});

stream.on('error', function (err) {
    if (err.message.indexOf('REFUSED')) {
        logger('Incident.MOOG Socket connection refused.', logL.ERROR);
        logger(err, logL.ERROR);
        logger('Please ensure there is a SERVER listening on ' + config.moogConf.host + ' port ' + config.moogConf.outPort, logL.ERROR);
    }
    else {
        logger('Stream connection error: ' + err, logL.ERROR);

    }
    terminate();
});

stream.on('data', function (data) {
    logger('Stream data: ' + data.toString(), logL.INFO);
});

stream.on('end', function () {
    logger('Stream disconnected ' + Date(), logL.WARN);
    terminate();
});

function processEv(mail) {
    if (!mail) {
        return;
    }
    var fromBlob = mail.from[0];
    var fromHost = mail.headers['received-spf'];
    fromHost = fromHost.match(/client-ip.*;/).toString();
    logger('Got Mail:' + JSON.stringify(mail, null, 2), logL.DEBUG);
    moogMsg = {};
    moogMsg.created_at = parseDate(mail.date + '');
    moogMsg.text = mail.text;
    moogMsg.subject = mail.subject;
    moogMsg.address = fromBlob.address;
    moogMsg.name = fromBlob.name;
    moogMsg.external_id = mail.messageId;
    moogMsg.severity = mail.priority;
    moogMsg.host = fromHost.substring(10, fromHost.length - 1);

    heartBeat(config.IMAPConf.severityType, moogMsg.severity);

    logger('Set moogMsg:' + JSON.stringify(moogMsg, null, 2), logL.INFO);
    if (config.moogConf.type == "J") {
        stream.write(config.moogConf.prefix + JSON.stringify(moogMsg) + '\n');
    }
}
function parseDate(text) {
    var d = new Date(Date.parse(text.replace(/( +)/, ' UTC$1')));
    return (d.valueOf() / 1000);
}
function writeFile() {
    try {
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    }
    catch (err) {
        if (err) {
            logger(err, logL.ERROR);
            return;
        }
    }
    logger('Status File Updated!', logL.INFO);
}

function heartBeat(type, value) {
    if (!config.nodeConf.heartbeat) return;
    beatCount++;
    if (value > maxVal) maxVal = value;
    if (value < minVal) minVal = value;
    totVal += value;
    if (beatCount >= config.nodeConf.heartbeatBeat) {
        console.log('[BEAT:] [' + Date() + '] Type:' + type + ' Min:' + minVal + ' Avg:' + Math.round(totVal / beatCount) + ' Max:' + maxVal);
        beatCount = 0;
        maxVal = 0;
        minVal = config.nodeConf.heartbeatBeat;
        totVal = 0;
    }
}
function getLogLevel(level) {
    var rt = 0;
    if (typeof level != 'string') {
        return rt;
    }
    switch (level) {
        case "ERROR":
            rt = logL.ERROR;
            break;
        case "WARN":
            rt = logL.WARN;
            break;
        case "INFO":
            rt = logL.INFO;
            break;
        case "DEBUG":
            rt = logL.DEBUG;
            break;
        default:
            rt = loglevels.INFO;
            break;
    }
    return rt;
}
function logger(message, level) {
    if (level > logLevel) return;
    switch (level) {
        case(logL.ERROR):
            console.log('[ERROR:] [' + Date() + '] ' + message);
            break;
        case(logL.WARN):
            console.log('[WARN:] [' + Date() + '] ' + message);
            break;
        case(logL.INFO):
            console.log('[INFO:] [' + Date() + '] ' + message);
            break;
        case(logL.DEBUG):
            console.log('[DEBUG:] [' + Date() + '] ' + message);
            break;
    }
}

function terminate() {
    try {
        // Cant writeFile(); as the callabck will not exist.
        stream.destroy();
        mailListener.stop();
    }
    catch (err) {
    }
    console.log('[STOP:] [' + Date() + '] Process terminated!.');
    process.exit(-1);
}

process.on('SIGINT', function () {
    logger("SIGINT Received.", logL.WARN);
    terminate();
});