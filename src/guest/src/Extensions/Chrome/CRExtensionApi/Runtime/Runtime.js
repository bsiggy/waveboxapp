const { ipcRenderer } = require('electron')
const url = require('url')
const req = require('../../../../req')
const {
  CRX_RUNTIME_SENDMESSAGE,
  CRX_RUNTIME_ONMESSAGE_,
  CRX_RUNTIME_CONTENTSCRIPT_CONNECT_
} = req.shared('crExtensionIpcEvents.js')
const {
  CR_EXTENSION_PROTOCOL,
  CR_RUNTIME_ENVIRONMENTS
} = req.shared('extensionApis.js')

const ArgParser = require('../Core/ArgParser')
const Event = require('../Core/Event')
const EventUnsupported = require('../Core/EventUnsupported')
const DispatchManager = require('../Core/DispatchManager')
const MessageSender = require('./MessageSender')
const {
  protectedHandleError,
  protectedCtrlEvt1,
  protectedCtrlEvt2,
  protectedCtrlEvt3
} = require('./ProtectedRuntimeSymbols')

const privExtensionId = Symbol('privExtensionId')
const privRuntimeEnvironment = Symbol('privRuntimeEnvironment')
const privErrors = Symbol('privErrors')
const privExtensionDatasource = Symbol('privExtensionDatasource')

class Runtime {
  /* **************************************************************************/
  // Lifecycle
  /* **************************************************************************/

  /**
  * https://developer.chrome.com/apps/runtime
  * @param extensionId: the id of the extension
  * @param runtimeEnvironment: the environment we're running in
  * @param extensionDatasource: the extension data source
  */
  constructor (extensionId, runtimeEnvironment, extensionDatasource) {
    // Private
    this[privExtensionId] = extensionId
    this[privRuntimeEnvironment] = runtimeEnvironment
    this[privExtensionDatasource] = extensionDatasource
    this[privErrors] = []
    this[protectedCtrlEvt1] = 6303
    this[protectedCtrlEvt2] = 10834
    this[protectedCtrlEvt3] = 16897

    // Protected
    this[protectedHandleError] = (err) => { this[privErrors][0] = err }

    // Functions
    this.onMessage = new Event()
    this.onInstalled = new EventUnsupported('chrome.runtime.onInstalled')

    Object.freeze(this)

    // Handlers
    DispatchManager.registerHandler(`${CRX_RUNTIME_ONMESSAGE_}${extensionId}`, this._handleRuntimeOnMessage.bind(this))

    // Connection
    if (this[privRuntimeEnvironment] === CR_RUNTIME_ENVIRONMENTS.CONTENTSCRIPT) {
      ipcRenderer.send(`${CRX_RUNTIME_CONTENTSCRIPT_CONNECT_}${this[privExtensionId]}`)
    }
  }

  /* **************************************************************************/
  // Properties
  /* **************************************************************************/

  get id () { return this[privExtensionId] }
  get lastError () { return this[privErrors][0] }
  get ctrlEventsInError () {
    let last
    try { last = this.lastError } catch (ex) { last = ex }
    return {
      lastError: last,
      ctrlEvents: [
        this[protectedCtrlEvt1],
        this[protectedCtrlEvt2],
        this[protectedCtrlEvt3]
      ]
    }
  }

  /* **************************************************************************/
  // Getters
  /* **************************************************************************/

  getURL (path) {
    return url.format({
      protocol: CR_EXTENSION_PROTOCOL,
      slashes: true,
      hostname: this[privExtensionId],
      pathname: path
    })
  }

  getManifest () {
    return this[privExtensionDatasource].manifest.cloneData()
  }

  /* **************************************************************************/
  // Setters
  /* **************************************************************************/

  get setUninstallURL () {
    if (this[privRuntimeEnvironment] === CR_RUNTIME_ENVIRONMENTS.CONTENTSCRIPT) {
      return undefined
    } else {
      return () => {
        console.warn('chrome.runtime.setUninstallURL is not supported by Wavebox at this time')
      }
    }
  }

  /* **************************************************************************/
  // Connection lifecycle
  /* **************************************************************************/

  sendMessage (...fullArgs) {
    if (this[privRuntimeEnvironment] === CR_RUNTIME_ENVIRONMENTS.BACKGROUND) {
      throw new Error('chrome.runtime.sendMessage is not supported in background page')
    }

    const { callback, args } = ArgParser.callback(fullArgs)
    const [targetExtensionId, message, options] = ArgParser.match(args, [
      { pattern: ['string', 'any', 'object'], out: [ArgParser.MATCH_ARG_0, ArgParser.MATCH_ARG_1, ArgParser.MATCH_ARG_2] },
      { pattern: ['string', 'any'], out: [ArgParser.MATCH_ARG_0, ArgParser.MATCH_ARG_1, undefined] },
      { pattern: ['any', 'object'], out: [this[privExtensionId], ArgParser.MATCH_ARG_0, ArgParser.MATCH_ARG_1] },
      { pattern: ['any'], out: [this[privExtensionId], ArgParser.MATCH_ARG_0, undefined] }
    ])

    if (options) {
      console.error('chrome.runtime.sendMessage does not support options')
    }

    DispatchManager.request(CRX_RUNTIME_SENDMESSAGE, [targetExtensionId, message], (evt, err, response) => {
      if (!err && callback) {
        callback(response)
      }
    })
  }

  /* **************************************************************************/
  // Event handlers
  /* **************************************************************************/

  /**
  * Handles a runtime message
  * @param evt: the event that fired
  * @param [extensionId, tabId, message]: the id of the extension to send the message to and the message
  * @param responseCallback: callback to execute with response
  */
  _handleRuntimeOnMessage (evt, [extensionId, tabId, message], responseCallback) {
    // Make sure we always respond even with control events
    switch (extensionId) {
      case this[protectedCtrlEvt1]:
        this.onMessage.emit(message, new MessageSender(extensionId, this[protectedCtrlEvt1]), (response) => {
          responseCallback(null, Object.assign({}, response, { ctrl1: true }))
        })
        break
      case this[protectedCtrlEvt2]:
        this.onMessage.emit(message, new MessageSender(extensionId, this[protectedCtrlEvt2]), (response) => {
          responseCallback(null, Object.assign({}, response, { inError: this.ctrlEventsInError }))
        })
        break
      case this[protectedCtrlEvt3]:
        this.onMessage.emit(message, new MessageSender(extensionId, this[protectedCtrlEvt3]), (response) => {
          responseCallback(null, { inError: this.ctrlEventsInError, ctrl3: true, ts: new Date().getTime() })
        })
        break
      default:
        this.onMessage.emit(message, new MessageSender(extensionId, tabId), (response) => {
          responseCallback(null, response)
        })
    }
  }
}

module.exports = Runtime
