/**
 * Created by jacky on 2017/2/4.
 */
'use strict';
var gcm = require('node-gcm');
var util = require('util');
var gcmConfig = require('./config.js').GCM;
var proxy = require('./config.js').Proxy;
var logger = require('./../mlogger/mlogger');
var VirtualDevice = require('./../virtual-device').VirtualDevice;
var OPERATION_SCHEMAS = {
    sendMessage: {
        "type": "object",
        "properties": {
            "target": {
                "oneOf": [
                    {
                        "type": "object",
                        "properties":{
                            "registrationIds": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required":["registrationIds"]
                    },
                    {
                        "type": "object",
                        "properties":{
                            "topic": {"type": "string"}
                        },
                        "required":["topic"]
                    },
                    {
                        "type": "object",
                        "properties":{
                            "notificationKey": {"type": "string"}
                        },
                        "required":["notificationKey"]
                    }
                ]
            },
            "options": {
                "type": "object",
                "properties": {
                    "anyOf": [
                        {
                            collapseKey: {"type": "string"}
                        },
                        {
                            priority: {"type": "string"}
                        },
                        {
                            contentAvailable: {"type": "string"}
                        },
                        {
                            timeToLive: {"type": "string"}
                        },
                        {
                            restrictedPackageName: {"type": "string"}
                        },
                        {
                            dryRun: {"type": "string"}
                        }
                    ]
                }
            },
            "payload": {
                "type": "object",
                "properties": {
                    "notification": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "body": {"type": "string"},
                            "anyOf": [
                                {
                                    icon: {"type": "string"}
                                },
                                {
                                    sound: {"type": "string"}
                                },
                                {
                                    badge: {"type": "string"}
                                },
                                {
                                    tag: {"type": "string"}
                                },
                                {
                                    color: {"type": "string"}
                                },
                                {
                                    click_action: {"type": "string"}
                                },
                                {
                                    body_loc_key: {"type": "string"}
                                },
                                {
                                    body_loc_args: {
                                        "type": "array",
                                        "items": {
                                            "type": "string"
                                        }
                                    }
                                },
                                {
                                    title_loc_args: {
                                        "type": "array",
                                        "items": {
                                            "type": "string"
                                        }
                                    }
                                },
                                {
                                    title_loc_key: {"type": "string"}
                                }
                            ]
                        },
                        "required": ["title", "body"]
                    },
                    "data": {
                        "type": "object"
                    }
                }
            }
        },
        "required": ["target", "payload"]
    }
};

function Notification(conx, uuid, token, configurator) {
    this.gcmSender = null;
    VirtualDevice.call(this, conx, uuid, token, configurator);
}
util.inherits(Notification, VirtualDevice);

Notification.prototype.init = function () {
    var apiKey = gcmConfig.ApiKey;
    var options = null;
    if (proxy) {
        options = {
            proxy: "http://" + proxy.host + ":" + proxy.port,
            timeout: 15000
        };
    }
    this.gcmSender = new gcm.Sender(apiKey, options);
};

/**
 * 远程RPC回调函数
 * @callback onMessage~sendMessage
 * @param {object} response:
 * {
 *      "payload":
 *      {
 *          "code":{number},
 *          "message":{string},
 *          "data":{object}
 *      }
 * }
 */
/**
 * 推送通知消息
 * @param {object} message :消息体
 * @param {onMessage~sendMessage} peerCallback: 远程RPC回调函数
 * */
//0001
Notification.prototype.sendMessage = function (message, peerCallback) {
    var self = this;
    var responseMessage = {code: 200, message: "Success.", data: null};
    self.messageValidate(message, OPERATION_SCHEMAS.sendMessage, function(error) {
        if (error) {
            responseMessage = error;
            peerCallback(error);
        }
        else{
            var messageInfo = message;
            var gcmMessage = new gcm.Message(messageInfo.options);
            if (messageInfo.payload.notification) {
                gcmMessage.addNotification(messageInfo.payload.notification);
            }
            if (messageInfo.payload.data) {
                gcmMessage.addData(messageInfo.payload.data);
            }
            //var sendTarget = messageInfo.target.registration_ids ? messageInfo.target.registration_ids
            //    : messageInfo.target.topic ? messageInfo.target.topic
            //    : messageInfo.target.notification_key;
            logger.debug("sendTarget:");
            logger.debug(messageInfo.target);
            self.gcmSender.sendNoRetry(gcmMessage, messageInfo.target, function (error, result) {
                if (error) {
                    var logError = {
                        errorId: 211001, errorMsg: error
                    };
                    logger.error(211001, error);
                    responseMessage.code = logError.errorId;
                    responseMessage.message = logError.errorMsg;
                }
                else {
                    responseMessage.data = result;
                    logger.debug("Send notification SUCCESS.");
                    logger.debug(result);
                }
                peerCallback({payload: responseMessage});
            });
        }
    });
};

module.exports = {
    Service: Notification,
    OperationSchemas: OPERATION_SCHEMAS
};