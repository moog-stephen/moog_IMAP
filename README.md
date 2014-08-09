# moog_IMAP


Connect IMAP mail feed them into incident.MOOG

## IMAP LAM Instructions

### IMAP e-mail to Incident.MOOG

This integration will listen to a specific IMAP hosted mailbox and pass ALL mail to a socket LAM. The integration works through a node.js script. The script produces JSON encoded emails to a socket. This page hosts the instructions and sample files.

**Observations:** - There are a few things that require consideration when taking emails into an Incident.MOOG system.
The signature options are limited. In the example I am using the host that sent the mail and the subject as the signature.

Only system generated emails should be used, this interface was built for customers who use SolarWinds email events.
The email body is not decoded in any way, the event is just the subject and body text
If there are multi line non paragraph text it is concatenated with either \n or nothing (not even a space)
#### To Do
Add a space at least between concatenated lines.
Instructions
You will need an IMAP mailbox (gmail is IMAP). Collect the credentials for the mail account and copy them to the IMAPconfig.js boilerplate file. Keep this file secure as it contains email account data.

Sample IMAPconfig.js

```
var IMAPcredentials = {
    name: 'Mail user name',
    email: 'mail use email address',
    username: 'mail account login id',
    password: 'mail account login password'
};

module.exports = IMAPcredentials;
```
####Install node.js
Install the node.js package and then install the moog_IMAP module for node. It is best if you create a directory $MOOGSOFT_HOME/node/MOOG_IMAP or $MOOGSOFT_HOME/../node/MOOG_IMAP and then add all the files from this directory there. CD into your node project directory before the npm install so that the mail-listener2 module is available to your project.
```
yum install nodejs 
yum install npm (The nodejs package does not contain npm.)
cd MOOGSOFT_HOME
mkdir node
cd node
cp -r <source directory for MOOG_IMAP> .
cd MOOG_IMAP
npm install
```
Edit the IMAPconfig.js file as explained above in the node/MOOG_IMAP directory.

Copy the imap_socket_lam.conf into the standard moogsoft conf directory ($MOOGSOFT_HOME/conf).

Update the imap_socket_ewe.conf file as follows.

Example imap_socket_ewe.conf
```
{
  "IMAPConf": {
    "imap": {
      "host": "imap.gmail.com",
      "port": 993,
      "secure": true,
      "mailbox": "INBOX",
      "markseen": false,
      "loadUnreadOnStart": false,
      "streamAttachments": false,
      "loadAttachments": false,
      "attachmentsDir": "attachments/"
    }
  },
  "moogConf": {
    "host": "192.168.56.101",
    "outPort": 8415,
    "type": "J",
    "delim": "||",
    "prefix": "MOOMAIL: "
  },
  "nodeConf": {
    "logLevel": "INFO",
    "heartbeat": true,
    "heartbeatBeat": 1000,
    "monitorName": "imap_socket_ewe",
    "closeTW": false,
    "retryTW": 10,
    "retryStream": 10
  }
}
```

#### Explanation of config file:
The **IMAPConf** section controls how the email server and mailbox is selected and filtered. markseen: Will mark each incoming mail as SEEN i.e. read, after it is processed. [true/false] loadAllOnStart: Will process all unread mail messages when the connection is established. [true/false]

The **moogConf** section needs to have the Moog host and outPort changed, only the JSON message type "J" is currently supported, so no other modifications to this section are required.

The **nodeConf** section, to change the logLevel, options are
 * ERROR
 * WARN
 * INFO
 * DEBUG

To include a heartbeat message in the stdOut set heartbeat to true and then set hearbeatBeats to the number of emails between heartbeat messages. The message will show a summary of the severity calculation
JSON message.

The email is transformed into a JSON message object (moogMsg) that is flat so that MOOG can perform the LAM mapping. Available items in the structure are:
```
var fromBlob = mail.from[0]; // Get the first set of from details
var fromHost = mail.headers['received-spf'];
fromHost = fromHost.match(/client-ip.*;/).toString();
moogMsg = {};
moogMsg.created_at = parseDate(mail.date+''); // Pass an epoc date
moogMsg.text = mail.text; //main body of mail
moogMsg.subject = mail.subject;
moogMsg.address = fromBlob.address;
moogMsg.name = fromBlob.name;
moogMsg.external_id = mail.messageId; //UUID of message
moogMsg.severity = mail.priority; //low, normal or high
moogMsg.host = fromHost.substring(10,fromHost.length - 1); // IP address of originating mail server
```
#### IMAP E-mail LAM
There is nothing special about the IMAP email lam conf see the available mapping information above for details on the fields that are available.
