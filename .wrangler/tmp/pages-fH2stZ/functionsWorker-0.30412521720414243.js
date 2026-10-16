var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../home/box/.local/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../home/box/.local/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _shared/auth.js
var COOKIE = "ds_session";
var SESSION_DAYS = 30;
var TOKEN_HOURS = 24;
var PBKDF2_ITER = 1e5;
var enc = new TextEncoder();
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }
  });
}
__name(json, "json");
var b64 = /* @__PURE__ */ __name((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), "b64");
var unb64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "unb64");
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
var randomToken = /* @__PURE__ */ __name((n = 32) => hex(crypto.getRandomValues(new Uint8Array(n))), "randomToken");
var sha256 = /* @__PURE__ */ __name(async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s))), "sha256");
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
__name(pbkdf2, "pbkdf2");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITER))}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  const [alg, iter, salt, want] = String(stored || "").split("$");
  if (alg !== "pbkdf2") return false;
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)));
  const exp = unb64(want);
  if (got.length !== exp.length) return false;
  let d = 0;
  for (let i = 0; i < got.length; i++) d |= got[i] ^ exp[i];
  return d === 0;
}
__name(verifyPassword, "verifyPassword");
async function readJson(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Bad origin");
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new HttpError(415, "Send JSON");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Bad JSON");
  }
}
__name(readJson, "readJson");
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
};
function wrap(fn) {
  return async (ctx) => {
    try {
      if (!ctx.env.DB) return json({ error: "Database not bound" }, 500);
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Server error" }, 500);
    }
  };
}
__name(wrap, "wrap");
var normEmail = /* @__PURE__ */ __name((s) => String(s || "").trim().toLowerCase(), "normEmail");
var validEmail = /* @__PURE__ */ __name((s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), "validEmail");
var validUsername = /* @__PURE__ */ __name((s) => /^[A-Za-z0-9_.-]{3,20}$/.test(s), "validUsername");
function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
__name(cookie, "cookie");
async function createSession(env2, userId) {
  const id = randomToken(32), now = Date.now();
  await env2.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(id), userId, now + SESSION_DAYS * 864e5, now).run();
  return cookie(id, SESSION_DAYS * 86400);
}
__name(createSession, "createSession");
function readCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
__name(readCookie, "readCookie");
async function currentUser(request, env2) {
  const id = readCookie(request);
  if (!id) return null;
  return env2.DB.prepare(
    "SELECT u.id, u.email, u.username, u.verified_at, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?"
  ).bind(await sha256(id), Date.now()).first();
}
__name(currentUser, "currentUser");
async function destroySession(request, env2) {
  const id = readCookie(request);
  if (id) await env2.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(id)).run();
}
__name(destroySession, "destroySession");
async function sendConfirmation(env2, request, user) {
  const recent = await env2.DB.prepare("SELECT expires_at FROM email_tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1").bind(user.id).first();
  if (recent && recent.expires_at - TOKEN_HOURS * 36e5 > Date.now() - 6e4) return { sent: false, reason: "wait" };
  const token = randomToken(32);
  await env2.DB.prepare("INSERT INTO email_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)").bind(await sha256(token), user.id, Date.now() + TOKEN_HOURS * 36e5).run();
  const link = `${new URL(request.url).origin}/api/auth/confirm?token=${token}`;
  if (!env2.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; confirmation email not sent for user", user.id);
    return { sent: false, reason: "no_provider" };
  }
  const from = env2.EMAIL_FROM || "Diamond Spaders <noreply@diamondspaders.online>";
  const html = `<div style="font-family:'Comic Sans MS','Comic Sans',cursive;background:#000;color:#f3bf56;padding:24px;border-radius:10px">
<h2 style="margin:0 0 12px">Welcome to Diamond Spaders, ${esc(user.username)}!</h2>
<p>Click below to confirm your email address:</p>
<p><a href="${link}" style="display:inline-block;background:#f3bf56;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Confirm my email</a></p>
<p style="font-size:13px">Or paste this link into your browser:<br><span style="color:#fff">${link}</span></p>
<p style="font-size:13px">This link expires in ${TOKEN_HOURS} hours. If you didn't sign up, ignore this email.</p></div>`;
  const text = `Welcome to Diamond Spaders, ${user.username}!

Confirm your email: ${link}

This link expires in ${TOKEN_HOURS} hours. If you didn't sign up, ignore this email.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env2.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [user.email], subject: "Confirm your Diamond Spaders account", html, text })
  });
  if (!r.ok) {
    console.error("Resend error", r.status, await r.text());
    return { sent: false, reason: "provider_error" };
  }
  return { sent: true };
}
__name(sendConfirmation, "sendConfirmation");
async function consumeToken(env2, token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  const h = await sha256(token);
  const row = await env2.DB.prepare("SELECT user_id, expires_at, used FROM email_tokens WHERE token = ?").bind(h).first();
  if (!row || row.used || row.expires_at < Date.now()) return null;
  await env2.DB.batch([
    env2.DB.prepare("UPDATE email_tokens SET used = 1 WHERE token = ?").bind(h),
    env2.DB.prepare("UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE id = ?").bind(Date.now(), row.user_id)
  ]);
  return row.user_id;
}
__name(consumeToken, "consumeToken");
var esc = /* @__PURE__ */ __name((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
var publicUser = /* @__PURE__ */ __name((u) => u && { id: u.id, email: u.email, username: u.username, verified: !!u.verified_at }, "publicUser");

// api/auth/confirm.js
async function onRequestGet({ request, env: env2 }) {
  const url = new URL(request.url);
  const userId = env2.DB ? await consumeToken(env2, url.searchParams.get("token")) : null;
  if (!userId) return Response.redirect(`${url.origin}/register?confirm=invalid`, 302);
  return new Response(null, { status: 302, headers: { Location: "/register?confirmed=1", "Set-Cookie": await createSession(env2, userId), "Cache-Control": "no-store" } });
}
__name(onRequestGet, "onRequestGet");

// api/auth/login.js
var onRequestPost = wrap(async ({ request, env: env2 }) => {
  const b = await readJson(request);
  const id = String(b.login || b.email || b.username || "").trim(), password = String(b.password || "");
  if (!id || !password) throw new HttpError(400, "Enter your email (or username) and password.");
  const u = await env2.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(normEmail(id), id).first();
  if (!u || !await verifyPassword(password, u.password_hash)) throw new HttpError(401, "Wrong email/username or password.");
  if (!u.verified_at) return json({ error: "Please confirm your email first. Check your inbox for the link.", unverified: true }, 403);
  return json({ ok: true, user: publicUser(u) }, 200, { "Set-Cookie": await createSession(env2, u.id) });
});

// api/auth/logout.js
var onRequestPost2 = wrap(async ({ request, env: env2 }) => {
  await destroySession(request, env2);
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
});

// api/auth/me.js
var onRequestGet2 = wrap(async ({ request, env: env2 }) => {
  const u = await currentUser(request, env2);
  return u ? json({ user: publicUser(u) }) : json({ user: null }, 401);
});

// api/auth/register.js
var onRequestPost3 = wrap(async ({ request, env: env2 }) => {
  const b = await readJson(request);
  const email = normEmail(b.email), username = String(b.username || "").trim(), password = String(b.password || "");
  if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!validUsername(username)) throw new HttpError(400, "Username must be 3-20 letters, numbers, _ . or -");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Password must be at least 8 characters.");
  const existing = await env2.DB.prepare("SELECT id, email, username, verified_at FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    let mail2 = { sent: false };
    if (!existing.verified_at) mail2 = await sendConfirmation(env2, request, existing);
    return json({ ok: true, emailSent: mail2.sent, message: "Check your email for a confirmation link." });
  }
  const taken = await env2.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
  if (taken) throw new HttpError(409, "That username is taken.");
  const hash = await hashPassword(password);
  const user = await env2.DB.prepare("INSERT INTO users (email, username, password_hash, verified_at, created_at) VALUES (?, ?, ?, NULL, ?) RETURNING id, email, username").bind(email, username, hash, Date.now()).first();
  const mail = await sendConfirmation(env2, request, user);
  return json({ ok: true, emailSent: mail.sent, reason: mail.reason, message: mail.sent ? "Check your email for a confirmation link." : "Account created, but the confirmation email could not be sent yet." }, 201);
});

// api/auth/resend.js
var onRequestPost4 = wrap(async ({ request, env: env2 }) => {
  const b = await readJson(request);
  const u = await env2.DB.prepare("SELECT id, email, username, verified_at FROM users WHERE email = ?").bind(normEmail(b.email)).first();
  if (u && !u.verified_at) await sendConfirmation(env2, request, u);
  return json({ ok: true, message: "If that account needs confirming, a new link is on its way." });
});

// api/img/[id].js
var TYPES = { "image/jpeg": 1, "image/webp": 1, "image/png": 1, "image/gif": 1 };
async function onRequestGet3({ params, env: env2 }) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await env2.DB.prepare("SELECT mime, data FROM msg_images WHERE id = ?").bind(id).first();
  if (!r || !TYPES[r.mime]) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = r.data instanceof ArrayBuffer ? r.data : new Uint8Array(r.data);
  return new Response(body, { headers: {
    "Content-Type": r.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline"
  } });
}
__name(onRequestGet3, "onRequestGet");

// api/live.js
var CAL_URL = "https://www.myleague.com/pages/remote/tournamentCalendar.php";
var UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120";
var TTL = 60;
var SVG_ICON = '<circle cx="11" cy="11" r="10" fill="#2a1608" stroke="#fbe646"/><path d="M11 4 C8 8 6 10 6 13 C6 16 8.5 17.5 11 16 C13.5 17.5 16 16 16 13 C16 10 14 8 11 4 Z" fill="#fbe646"/>';
var BG_EVEN = "#1a1200";
var BORDER = "#fbe646";
function etParts(d) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(d)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour % 24 * 60 + +p.minute };
}
__name(etParts, "etParts");
function addDays(iso, n) {
  const d = /* @__PURE__ */ new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
__name(addDays, "addDays");
var WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function dayLabel(day, today) {
  if (day === today) return "TODAY";
  if (day === addDays(today, -1)) return "YESTERDAY";
  return WEEKDAYS[(/* @__PURE__ */ new Date(day + "T12:00:00Z")).getUTCDay()];
}
__name(dayLabel, "dayLabel");
function unxml(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
__name(unxml, "unxml");
async function fetchCalendar(start, end, league) {
  const [sy, sm, sd] = start.split("-").map(Number), [ey, em, ed] = end.split("-").map(Number);
  const body = new URLSearchParams({
    range: "daily",
    strLadder: league,
    DisplayCount: "300",
    page: "1",
    sort: "1",
    sd,
    sm,
    sy,
    ed,
    em,
    ey
  });
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(CAL_URL, { method: "POST", body, headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded"
      } });
      const t = await r.text();
      if (r.ok && /<SQLResults/.test(t)) return t;
      last = new Error(`calendar HTTP ${r.status}${/Just a moment/i.test(t) ? " (challenge)" : ""}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
__name(fetchCalendar, "fetchCalendar");
function parseCalendar(xml) {
  const out = [], seen = /* @__PURE__ */ new Set();
  for (const rec of xml.match(/<objRecord>[\s\S]*?<\/objRecord>/g) || []) {
    const d = {};
    for (const m of rec.slice(11, -12).matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) d[m[1]] = unxml(m[2]).trim();
    const t = parseInt(d.time, 10), y = parseInt(d.year, 10), mo = parseInt(d.month, 10), dd = parseInt(d.day, 10);
    if ([t, y, mo, dd].some(Number.isNaN)) continue;
    if (d.tcount && seen.has(d.tcount)) continue;
    seen.add(d.tcount);
    const date = `${y}-${String(mo + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    out.push({
      id: d.tcount || "",
      date,
      h: Math.floor(t / 100),
      m: t % 100,
      td: d.td || "",
      game: d.location || "",
      status: d.status || "",
      perteam: d.perteam || "",
      winners: (d.winner || "").split(",").map((s) => s.trim()).filter(Boolean)
    });
  }
  out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.h - b.h || a.m - b.m || (a.id < b.id ? -1 : 1));
  return out;
}
__name(parseCalendar, "parseCalendar");
var ambiguous = /* @__PURE__ */ __name((t) => String(t.perteam) === "2" && /^(\d ?VS\.? ?\d|SPADES)?$/.test(t.game.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim()), "ambiguous");
async function tourName(tid, league) {
  const ck = new Request(`https://diamondspaders.online/__tourname/${league}/${tid}`);
  try {
    const hit = await caches.default.match(ck);
    if (hit) return await hit.text();
    const r = await fetch(`https://cgi6.igl.net/tourney/${league}/${tid}/`, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const page = await r.text();
    const m = page.match(/<h2>([\s\S]*?)<\/h2>/) || page.match(/<title>[^<]*?'s ([\s\S]*?) Tournament\s*<\/title>/);
    const name = m ? unxml(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
    await caches.default.put(ck, new Response(name, { headers: { "cache-control": "public, max-age=21600" } }));
    return name;
  } catch (e) {
    return null;
  }
}
__name(tourName, "tourName");
function makeRenderer(cfg, names = {}) {
  const aliases = cfg.aliases || {};
  const shown = /* @__PURE__ */ __name((n) => aliases[n] ?? n, "shown");
  const key = /* @__PURE__ */ __name((n) => shown(n).toLowerCase(), "key");
  const esc2 = /* @__PURE__ */ __name((s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "esc");
  const L = cfg.labels || {};
  const noC = /* @__PURE__ */ __name((o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("_"))), "noC");
  const byId = noC(L.by_id), slot = Object.fromEntries(Object.entries(noC(L.by_slot)).map(([k, v]) => [k.toLowerCase(), v]));
  const rx = /* @__PURE__ */ __name((s) => new RegExp(s, "i"), "rx");
  const raw = (L.raw_rules || []).map((r) => [rx(r.match), r.perteam ?? null, r.label]);
  const rules = (L.rules || []).map((r) => [rx(r.match), r.match2 ? rx(r.match2) : null, r.not ? rx(r.not) : null, r.perteam ?? null, r.label]);
  const normFeed = /* @__PURE__ */ __name((s) => s.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim(), "normFeed");
  const pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
  function gameLabel(text) {
    let s = text.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim();
    if (/^\d\s*VS\s*\d$/.test(s)) return "PARDS";
    s = s.replace(/\bPARD A BOT SUI(CIDE)?\b/g, "SUI PAB").replace(/\bPARD A BOT\b/g, "PAB").replace(/\bSUICIDE\b/g, "SUI").replace(/^REG(ULAR)? /, "");
    return s.replace(/\s+/g, " ").trim() || "SPADES";
  }
  __name(gameLabel, "gameLabel");
  function mapped(t) {
    if (byId[t.id] != null) return byId[t.id];
    const n = normFeed(t.game);
    const k = `${t.td}|${pad(t.h)}:${pad(t.m)}|${n}`.toLowerCase();
    if (slot[k] != null) return slot[k];
    const pt = parseInt(t.perteam, 10) || 0;
    for (const [r, p, lab] of raw) if (r.test(t.game) && (p === null || p === pt)) return lab;
    for (const [r, r2, rn, p, lab] of rules)
      if (r.test(n) && (!r2 || r2.test(n)) && (!rn || !rn.test(n)) && (p === null || p === pt)) return lab;
    return null;
  }
  __name(mapped, "mapped");
  function mapped2(t) {
    if (byId[t.id] != null) return byId[t.id];
    if (ambiguous(t) && names[t.id]) {
      const saved = t.game;
      t.game = names[t.id];
      const lab = mapped({ ...t, id: "" });
      t.game = saved;
      if (lab) return lab;
    }
    return mapped(t);
  }
  __name(mapped2, "mapped2");
  const label = /* @__PURE__ */ __name((t) => (cfg.labels_by_id || {})[t.id] ?? mapped2(t) ?? gameLabel(t.game), "label");
  const clock12 = /* @__PURE__ */ __name((h, m) => `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`, "clock12");
  const nameSize = /* @__PURE__ */ __name((n) => n.length <= 9 ? 22 : n.length <= 12 ? 20 : n.length <= 15 ? 18 : 16, "nameSize");
  function avatar(name) {
    if ((cfg.avatar_overrides || {})[name]) return cfg.avatar_overrides[name];
    const av = cfg.avatars || {};
    for (const k of [key(name), shown(name).replace(/\s+/g, "").toLowerCase(), name.replace(/\s+/g, "").toLowerCase()])
      if (av[k]) return av[k];
    return null;
  }
  __name(avatar, "avatar");
  const icon = /* @__PURE__ */ __name((url, size, radius) => url ? `<img src="${url}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius}px;border:1px solid ${BORDER};">` : `<svg width="${size}" height="${size}" viewBox="0 0 22 22">${SVG_ICON}</svg>`, "icon");
  function teamName(t) {
    const n = (cfg.manual_teams || {})[String(t.id)];
    if (n) return n;
    return t.winners.length === 2 ? t.winners.map(shown).join(" & ") : null;
  }
  __name(teamName, "teamName");
  const attr = /* @__PURE__ */ __name((s) => esc2(s).replace(/"/g, "&quot;").replace(/'/g, "&#x27;"), "attr");
  const champ = /* @__PURE__ */ __name((sub) => sub ? ` <span class="ds-champ" title="${attr(sub)}">${esc2(sub.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase())}</span>` : "", "champ");
  const subtitle = /* @__PURE__ */ __name((t) => (cfg.subtitles || {})[String(t.id)] || null, "subtitle");
  function winnerCell(i, lab, names2, size, team, sub) {
    const bg = i % 2 === 0 ? `background:${BG_EVEN};` : "background:#000;";
    if (names2.length === 1) {
      const n = shown(names2[0]);
      return `<div style="padding:14px 10px;${bg}"><div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">${icon(avatar(names2[0]), 64, 8)}<div><div style="font-size:13px;font-weight:700;">${esc2(lab)}${champ(sub)}</div><div style="font-size:${size || nameSize(n)}px;font-weight:800;">${esc2(n)}</div></div></div></div>`;
    }
    const longest = Math.max(...names2.map((w) => shown(w).length));
    const fs = longest <= 7 ? 15 : longest <= 9 ? 14 : longest <= 11 ? 13 : 12;
    const pairs = names2.map((w) => `<div style="display:flex;align-items:center;gap:6px;min-width:0;">${icon(avatar(w), 44, 8)}<div style="font-size:${fs}px;font-weight:800;overflow-wrap:anywhere;line-height:1.1;">${esc2(shown(w))}</div></div>`).join("");
    const teamHtml = team ? `<div style="font-size:14px;font-weight:600;color:#fbe646;margin-bottom:6px;text-align:center;">${esc2(team)}</div>` : '<div style="margin-bottom:4px;"></div>';
    return `<div style="padding:14px 10px;${bg}"><div style="font-size:13px;font-weight:700;margin-bottom:2px;">${esc2(lab)}${champ(sub)}</div>${teamHtml}<div style="display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:6px;">${pairs}</div></div>`;
  }
  __name(winnerCell, "winnerCell");
  function day(tours, d, today) {
    const dl = dayLabel(d, today), cells = [], keys = [];
    for (const t of tours) {
      if (t.date !== d || !t.winners.length || (cfg.hidden || []).map(String).includes(String(t.id))) continue;
      const clk = clock12(t.h, t.m), lab = label(t);
      const text = dl === "TODAY" || dl === "YESTERDAY" ? `${clk} ${lab}` : `${dl} ${clk} ${lab}`;
      const size = (cfg.fonts || {})[`${clk}|${t.winners.map((n) => shown(n).toLowerCase()).join(",")}`];
      cells.push(winnerCell(cells.length, text, t.winners, size, teamName(t), subtitle(t)));
      keys.push(`${clk}|${lab}|${t.winners.map((n) => shown(n).toLowerCase()).join("&")}|${t.winners.length === 2 ? teamName(t) : ""}`);
    }
    return {
      heading: dl,
      cells,
      keys,
      heading_html: `<div style="grid-column:1/-1;padding:12px 10px 4px;font-size:15px;font-weight:800;letter-spacing:0.14em;color:#fbe646;">${dl}</div>`,
      empty_html: `<div style="grid-column:1/-1;padding:14px 10px;font-size:13px;font-weight:700;">${dl} &mdash; ${d === today ? "no winners yet" : "no winners recorded"}</div>`
    };
  }
  __name(day, "day");
  return { label, avatar, day, subtitle };
}
__name(makeRenderer, "makeRenderer");
async function build(env2, origin) {
  const cfgRes = await env2.ASSETS.fetch(new Request(origin + "/live/config.json"));
  if (!cfgRes.ok) throw new Error("config.json " + cfgRes.status);
  const cfg = await cfgRes.json();
  const now = /* @__PURE__ */ new Date(), et = etParts(now), today = et.date;
  const xml = await fetchCalendar(addDays(today, -2), addDays(today, 2), cfg.league || "diamondspaders");
  const tours = parseCalendar(xml);
  const mw = cfg.manual_winners || {}, mo = cfg.manual_overrides || {};
  for (const t of tours) {
    if (!t.winners.length && mw[t.id]?.length) t.winners = [...mw[t.id]];
    if (mo[t.id]?.length) t.winners = [...mo[t.id]];
  }
  const names = {};
  await Promise.all(tours.filter((t) => t.date >= today && ambiguous(t) && (cfg.labels_by_id || {})[t.id] == null).map(async (t) => {
    const n = await tourName(t.id, cfg.league || "diamondspaders");
    if (n) names[t.id] = n;
  }));
  const R = makeRenderer(cfg, names), hidden = new Set((cfg.hidden || []).map(String));
  const days = {};
  for (const d of [today, addDays(today, -1), addDays(today, -2)]) days[d] = R.day(tours, d, today);
  const upcoming = tours.filter((t) => !hidden.has(String(t.id)) && t.date === today && !t.winners.length && t.status !== "2" && et.min < t.h * 60 + t.m + 50).map((t) => ({ dt: t.date, h: t.h, m: t.m, game: R.label(t), td: t.td, url: (cfg.tour_url || "").replace("%s", t.id), ava: R.avatar(t.td) || "", ...R.subtitle(t) ? { sub: R.subtitle(t) } : {} }));
  return { ok: true, now: now.toISOString(), today, days, tours: upcoming };
}
__name(build, "build");
async function onRequestGet4({ request, env: env2, waitUntil }) {
  const url = new URL(request.url);
  const cache = caches.default, ck = new Request(url.origin + "/api/live?cache=v1");
  const hit = await cache.match(ck);
  if (hit) return hit;
  let body, status = 200;
  try {
    body = await build(env2, url.origin);
  } catch (e) {
    body = { ok: false, error: String(e && e.message || e) };
    status = 502;
  }
  const res = new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=${status === 200 ? 30 : 0}`,
    "access-control-allow-origin": "*"
  } });
  if (status === 200) {
    const c = new Response(res.clone().body, res);
    c.headers.set("cache-control", `public, max-age=${TTL}`);
    waitUntil(cache.put(ck, c));
  }
  return res;
}
__name(onRequestGet4, "onRequestGet");

// _shared/pins.js
var MAX_FAILS = 5;
var LOCK_MIN = 15;
var normName = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/\s+/g, " ").trim(), "normName");
var validPin = /* @__PURE__ */ __name((p) => /^\d{3}$/.test(String(p ?? "")), "validPin");
async function pinRow(env2, name) {
  return env2.DB.prepare("SELECT name, pin_hash, fails, locked_until FROM msg_pins WHERE name = ? COLLATE NOCASE").bind(name).first();
}
__name(pinRow, "pinRow");
var MAX_EMAIL = 254;
function checkEmail(e) {
  const n = String(e ?? "").trim().toLowerCase();
  if (n.length > MAX_EMAIL) throw new HttpError(400, "That email address is too long.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(n)) throw new HttpError(400, "Please enter a valid email address (like name@example.com).");
  return n;
}
__name(checkEmail, "checkEmail");
var sha256hex = /* @__PURE__ */ __name(async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join(""), "sha256hex");
async function setPin(env2, name, pin, email) {
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  if (!validPin(pin)) throw new HttpError(400, "PIN must be exactly 3 digits (000-999).");
  const emailHash = await sha256hex("ds-email:" + checkEmail(email));
  const r = await env2.DB.prepare("INSERT OR IGNORE INTO msg_pins (name, pin_hash, email_hash, created_at) VALUES (?, ?, ?, ?)").bind(name, await hashPassword(String(pin)), emailHash, Date.now()).run();
  if (!r.meta || !r.meta.changes) throw new HttpError(409, "That name already has a PIN. Enter it instead.");
}
__name(setPin, "setPin");
async function checkPin(env2, name, pin) {
  const row = await pinRow(env2, name);
  if (!row) throw new HttpError(428, "Create a 3-digit PIN for this name first.");
  const now = Date.now();
  if (row.locked_until > now) {
    const m = Math.ceil((row.locked_until - now) / 6e4);
    throw new HttpError(429, `Too many wrong PINs. Try again in ${m} minute${m === 1 ? "" : "s"}.`);
  }
  if (validPin(pin) && await verifyPassword(String(pin), row.pin_hash)) {
    if (row.fails) await env2.DB.prepare("UPDATE msg_pins SET fails = 0, locked_until = 0 WHERE name = ?").bind(row.name).run();
    return row.name;
  }
  const fails = row.fails + 1, lock = fails >= MAX_FAILS;
  await env2.DB.prepare("UPDATE msg_pins SET fails = ?, locked_until = ? WHERE name = ?").bind(lock ? 0 : fails, lock ? now + LOCK_MIN * 6e4 : 0, row.name).run();
  throw new HttpError(lock ? 429 : 401, lock ? `Too many wrong PINs. Try again in ${LOCK_MIN} minutes.` : "Wrong PIN. Please try again.");
}
__name(checkPin, "checkPin");
var REMEMBER_DAYS = 30;
var TOKEN_COOKIE = "ds_pin_token";
var tokenHash = /* @__PURE__ */ __name((t) => sha256hex("ds-pin-token:" + t), "tokenHash");
function cookieVal(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
__name(cookieVal, "cookieVal");
var cookieAttrs = /* @__PURE__ */ __name((request) => "; Path=/; HttpOnly; SameSite=Strict" + (new URL(request.url).protocol === "https:" ? "; Secure" : ""), "cookieAttrs");
async function issueToken(env2, request, name) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now(), expires = now + REMEMBER_DAYS * 864e5;
  await env2.DB.prepare("DELETE FROM msg_pin_tokens WHERE expires < ?").bind(now).run();
  await env2.DB.prepare("INSERT INTO msg_pin_tokens (token_hash, name, expires, created_at) VALUES (?, ?, ?, ?)").bind(await tokenHash(token), name, expires, now).run();
  return { cookie: `${TOKEN_COOKIE}=${token}; Max-Age=${REMEMBER_DAYS * 86400}` + cookieAttrs(request), expires };
}
__name(issueToken, "issueToken");
async function tokenName(env2, request) {
  const t = cookieVal(request, TOKEN_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(t)) return "";
  const row = await env2.DB.prepare(
    "SELECT p.name AS name FROM msg_pin_tokens t JOIN msg_pins p ON p.name = t.name COLLATE NOCASE WHERE t.token_hash = ? AND t.expires > ?"
  ).bind(await tokenHash(t), Date.now()).first();
  return row ? row.name : "";
}
__name(tokenName, "tokenName");
async function forgetToken(env2, request) {
  const t = cookieVal(request, TOKEN_COOKIE);
  if (/^[0-9a-f]{64}$/.test(t)) await env2.DB.prepare("DELETE FROM msg_pin_tokens WHERE token_hash = ?").bind(await tokenHash(t)).run();
  return `${TOKEN_COOKIE}=; Max-Age=0` + cookieAttrs(request);
}
__name(forgetToken, "forgetToken");

// api/messages.js
var SHOW = 200;
var MAX_NAME = 40;
var MAX_MSG = 1e3;
var MAX_IMG = 400 * 1024;
var MAX_GIF = 1536 * 1024;
var GIF_MSG = "GIFs must be under 1.5 MB.";
var IMG_PER_HOUR = 10;
var IMG_PER_DAY = 300;
var IMG_TAG = /\[img:/i;
var MIN_IMG_CLIENT = 55;
async function fetchGif(u) {
  let url;
  try {
    url = new URL(String(u || ""));
  } catch {
    throw new HttpError(400, "Bad picture link.");
  }
  const h = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username || /^(localhost|.*\.local|.*\.internal)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(":"))
    throw new HttpError(400, "That picture link can't be used. Save the GIF and upload it with the picture button instead.");
  let r;
  try {
    r = await fetch(url.href, { redirect: "follow", signal: AbortSignal.timeout(8e3), headers: { "Accept": "image/gif,image/*" } });
  } catch {
    throw new HttpError(502, "Couldn't download that GIF. Save it and upload it with the picture button instead.");
  }
  if (!r.ok || !r.body) throw new HttpError(502, "Couldn't download that GIF. Save it and upload it with the picture button instead.");
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_GIF) throw new HttpError(413, GIF_MSG);
  const reader = r.body.getReader(), parts = [];
  let n = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > MAX_GIF) {
      try {
        reader.cancel();
      } catch {
      }
      throw new HttpError(413, GIF_MSG);
    }
    parts.push(value);
  }
  const b = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    b.set(p, o);
    o += p.length;
  }
  const sig = String.fromCharCode(...b.slice(0, 6));
  if (sig !== "GIF87a" && sig !== "GIF89a") throw new HttpError(415, "NOTGIF");
  return { mime: "image/gif", data: b };
}
__name(fetchGif, "fetchGif");
function decodeImage(v) {
  const m = /^data:(image\/(?:jpeg|webp|png|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ""));
  if (!m) throw new HttpError(415, "Only JPEG, WebP, PNG or GIF images can be posted.");
  const isGif = m[1] === "image/gif", lim = isGif ? MAX_GIF : MAX_IMG;
  if (m[2].length > Math.ceil(lim * 4 / 3) + 8) throw new HttpError(413, isGif ? GIF_MSG : "That image is too big.");
  let bin;
  try {
    bin = atob(m[2]);
  } catch {
    throw new HttpError(400, "Bad image data.");
  }
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  if (b.length > lim) throw new HttpError(413, isGif ? GIF_MSG : "That image is too big.");
  if (b.length < 32) throw new HttpError(415, "That file isn't a supported image.");
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const png = b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71;
  const webp = String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  const gif = String.fromCharCode(...b.slice(0, 6)) === "GIF87a" || String.fromCharCode(...b.slice(0, 6)) === "GIF89a";
  const mime = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : gif ? "image/gif" : "";
  if (!mime) throw new HttpError(415, "That file isn't a supported image.");
  if (mime !== "image/gif" && b.length > MAX_IMG) throw new HttpError(413, "That image is too big.");
  return { mime, data: b };
}
__name(decodeImage, "decodeImage");
async function list(env2) {
  const r = await env2.DB.prepare(
    "SELECT id, name, message, t FROM (SELECT * FROM messages ORDER BY t DESC LIMIT ?) ORDER BY t ASC"
  ).bind(SHOW).all();
  return r.results || [];
}
__name(list, "list");
function clean(m, now) {
  if (!m || typeof m !== "object") throw new HttpError(400, "Bad message");
  const name = String(m.name ?? "").replace(/\s+/g, " ").trim();
  const message = m.image || m.imageUrl ? "[img]" : String(m.message ?? "").replace(/\r\n?/g, "\n").trim();
  if (!m.image && !m.imageUrl && IMG_TAG.test(message)) throw new HttpError(400, "Message can't contain [img: tags.");
  if (!name) throw new HttpError(400, "Name is required.");
  if (!message) throw new HttpError(400, "Message is required.");
  if (name.length > MAX_NAME) throw new HttpError(400, `Name must be ${MAX_NAME} characters or less.`);
  if (message.length > MAX_MSG) throw new HttpError(400, `Message must be ${MAX_MSG} characters or less.`);
  let id = String(m.id ?? "");
  if (!/^[A-Za-z0-9_.-]{4,80}$/.test(id)) id = now.toString(36) + "-" + crypto.randomUUID().slice(0, 8);
  return { id, name, message, t: now };
}
__name(clean, "clean");
var onRequestGet5 = wrap(async ({ env: env2 }) => json({ messages: await list(env2) }));
var onRequestPost5 = wrap(async ({ request, env: env2 }) => {
  const b = await readJson(request);
  if (b && b.website) throw new HttpError(400, "Rejected");
  const now = Date.now();
  const m = clean(b, now);
  if (/^\d{3}$/.test(String(b.pin ?? ""))) m.name = await checkPin(env2, m.name, b.pin);
  else {
    const tn = await tokenName(env2, request);
    if (tn && tn.toLowerCase() === m.name.toLowerCase()) m.name = tn;
    else if (!await pinRow(env2, m.name)) throw new HttpError(428, "Create a 3-digit PIN for this name first.");
    else throw new HttpError(401, "Please enter your PIN.");
  }
  if (b.image || b.imageUrl) {
    if (!(Number(b.cv) >= MIN_IMG_CLIENT)) throw new HttpError(426, "The message board was updated. Please reload the page (pull down or press F5), then post your picture again.");
    const img = b.imageUrl ? await fetchGif(b.imageUrl) : decodeImage(b.image);
    const hour = await env2.DB.prepare("SELECT COUNT(*) AS n FROM msg_images WHERE name = ? COLLATE NOCASE AND t > ?").bind(m.name, now - 36e5).first();
    if (hour && hour.n >= IMG_PER_HOUR) throw new HttpError(429, `You can post ${IMG_PER_HOUR} pictures an hour. Please try again later.`);
    const day = await env2.DB.prepare("SELECT COUNT(*) AS n FROM msg_images WHERE t > ?").bind(now - 864e5).first();
    if (day && day.n >= IMG_PER_DAY) throw new HttpError(429, "Too many pictures today. Please try again tomorrow.");
    const imgId = m.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(6, "0");
    m.message = "[img:" + imgId + "]";
    await env2.DB.batch([
      env2.DB.prepare("INSERT OR IGNORE INTO msg_images (id, name, mime, bytes, data, t) VALUES (?, ?, ?, ?, ?, ?)").bind(imgId, m.name, img.mime, img.data.length, img.data, now),
      env2.DB.prepare("INSERT OR IGNORE INTO messages (id, name, message, t) VALUES (?, ?, ?, ?)").bind(m.id, m.name, m.message, m.t)
    ]);
    return json({ ok: true, ids: [m.id], messages: await list(env2) }, 201);
  }
  await env2.DB.prepare("INSERT OR IGNORE INTO messages (id, name, message, t) VALUES (?, ?, ?, ?)").bind(m.id, m.name, m.message, m.t).run();
  const rows = [m];
  return json({ ok: true, ids: rows.map((m2) => m2.id), messages: await list(env2) }, 201);
});

// api/pin.js
var onRequestGet6 = wrap(async ({ request, env: env2 }) => {
  const name = normName(new URL(request.url).searchParams.get("name"));
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  const row = await pinRow(env2, name);
  const tn = row ? await tokenName(env2, request) : "";
  return json({ name, hasPin: !!row, remembered: !!tn && tn.toLowerCase() === row.name.toLowerCase() });
});
var onRequestPost6 = wrap(async ({ request, env: env2 }) => {
  const b = await readJson(request);
  if (b?.action === "forget") return json({ ok: true }, 200, { "Set-Cookie": await forgetToken(env2, request) });
  const name = normName(b?.name);
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  let canon, status = 200;
  if (b?.action === "set") {
    await setPin(env2, name, b.pin, b.email);
    canon = (await pinRow(env2, name)).name;
    status = 201;
  } else if (b?.action === "check") canon = await checkPin(env2, name, b.pin);
  else throw new HttpError(400, "action must be set, check or forget");
  if (b.remember === true) {
    const t = await issueToken(env2, request, canon);
    return json({ ok: true, created: status === 201, remembered: true, expires: t.expires }, status, { "Set-Cookie": t.cookie });
  }
  return json({ ok: true, created: status === 201 }, status);
});

// api/count.js
var GC = "https://ochwiay.goatcounter.com/count";
var GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
async function onRequest({ request }) {
  const u = new URL(request.url);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const h = {
    "User-Agent": request.headers.get("User-Agent") || "",
    "Accept-Language": request.headers.get("Accept-Language") || "",
    "X-Forwarded-For": ip,
    "X-Real-IP": ip
  };
  const ref2 = request.headers.get("Referer");
  if (ref2) h["Referer"] = ref2;
  const q = new URLSearchParams(u.search);
  if (q.has("noscript") && !q.has("r") && ref2) q.set("r", "");
  let status = 0, gch = "";
  try {
    const r = await fetch(GC + "?" + q.toString(), { method: "GET", headers: h });
    status = r.status;
    gch = r.headers.get("X-Goatcounter") || "";
  } catch (e) {
    status = -1;
  }
  return new Response(GIF, { headers: {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store",
    "X-Upstream": String(status),
    ...gch ? { "X-Goatcounter": gch } : {}
  } });
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-fH2stZ/functionsRoutes-0.03598918256495387.mjs
var routes = [
  {
    routePath: "/api/auth/confirm",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/resend",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/img/:id",
    mountPath: "/api/img",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/live",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/messages",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/messages",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/pin",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/pin",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/count",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../home/box/.local/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count3 = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count3--;
          if (count3 === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count3++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count3)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../home/box/.local/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env2, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context2 = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env: env2,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context2);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error3) {
      if (isFailOpen) {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error3;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
