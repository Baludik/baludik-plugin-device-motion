/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

/**
 * This class provides access to device devicemotion data.
 * @constructor
 */
var argscheck = require("cordova/argscheck"),
  utils = require("cordova/utils"),
  exec = require("cordova/exec"),
  Motion = require("./Motion");
compass = require("./compass");

// Is the motion sensor running?
var running = false;

// Keeps reference to watchMotion calls.
var timers = {};

// Array of listeners; used to keep track of when we should call start and stop.
var listeners = [];

// Last returned motioneration object from native
var motion = null;

// Timer used when faking up devicemotion events
var eventTimerId = null;

var compassId = null;
var lastTrueHeading = null;

// Tells native to start.
function start() {
  // start compass
  compassId = compass.watchHeading(
    function(e) {
      lastTrueHeading = e.trueHeading;
    },
    function() {},
    { frequency: 50 }
  );
  // start device motion
  exec(
    function(a) {
      var tempListeners = listeners.slice(0);
      motion = new Motion(
        a.yaw,
        a.pitch,
        a.roll,
        a.alpha,
        a.beta,
        a.gamma,
        lastTrueHeading ? lastTrueHeading : a.alpha,
        a.timestamp
      );
      for (var i = 0, l = tempListeners.length; i < l; i++) {
        tempListeners[i].win(motion);
      }
    },
    function(e) {
      var tempListeners = listeners.slice(0);
      for (var i = 0, l = tempListeners.length; i < l; i++) {
        tempListeners[i].fail(e);
      }
    },
    "Devicemotion",
    "start",
    []
  );
  running = true;
}

// Tells native to stop.
function stop() {
  compass.clearWatch(compassId);
  exec(null, null, "Devicemotion", "stop", []);
  motion = null;
  running = false;
}

// Adds a callback pair to the listeners array
function createCallbackPair(win, fail) {
  return { win: win, fail: fail };
}

// Removes a win/fail listener pair from the listeners array
function removeListeners(l) {
  var idx = listeners.indexOf(l);
  if (idx > -1) {
    listeners.splice(idx, 1);
    if (listeners.length === 0) {
      stop();
    }
  }
}

var devicemotion = {
  /**
   * Asynchronously acquires the current motioneration.
   *
   * @param {Function} successCallback    The function to call when the motioneration data is available
   * @param {Function} errorCallback      The function to call when there is an error getting the motioneration data. (OPTIONAL)
   * @param {MotionOptions} options The options for getting the devicemotion data such as timeout. (OPTIONAL)
   */
  getCurrentMotion: function(successCallback, errorCallback, options) {
    argscheck.checkArgs("fFO", "devicemotion.getCurrentMotion", arguments);

    var p;
    var win = function(a) {
      removeListeners(p);
      successCallback(a);
    };
    var fail = function(e) {
      removeListeners(p);
      if (errorCallback) {
        errorCallback(e);
      }
    };

    p = createCallbackPair(win, fail);
    listeners.push(p);

    if (!running) {
      start();
    }
  },

  /**
   * Asynchronously acquires the motioneration repeatedly at a given interval.
   *
   * @param {Function} successCallback    The function to call each time the motioneration data is available
   * @param {Function} errorCallback      The function to call when there is an error getting the motioneration data. (OPTIONAL)
   * @param {MotionOptions} options The options for getting the devicemotion data such as timeout. (OPTIONAL)
   * @return String                       The watch id that must be passed to #clearWatch to stop watching.
   */
  watchMotion: function(successCallback, errorCallback, options) {
    argscheck.checkArgs("fFO", "devicemotion.watchMotion", arguments);
    // Default interval (50 ms)
    var frequency =
      options && options.frequency && typeof options.frequency == "number"
        ? options.frequency
        : 50;

    // Keep reference to watch id, and report motion readings as often as defined in frequency
    var id = utils.createUUID();

    var p = createCallbackPair(
      function() {},
      function(e) {
        removeListeners(p);
        if (errorCallback) {
          errorCallback(e);
        }
      }
    );
    listeners.push(p);

    timers[id] = {
      timer: window.setInterval(function() {
        if (motion) {
          successCallback(motion);
        }
      }, frequency),
      listeners: p
    };

    if (running) {
      // If we're already running then immediately invoke the success callback
      // but only if we have retrieved a value, sample code does not check for null ...
      if (motion) {
        successCallback(motion);
      }
    } else {
      start();
    }

    return id;
  },

  /**
   * Clears the specified devicemotion watch.
   *
   * @param {String} id       The id of the watch returned from #watchMotion.
   */
  clearWatch: function(id) {
    // Stop javascript timer & remove from timer list
    if (id && timers[id]) {
      window.clearInterval(timers[id].timer);
      removeListeners(timers[id].listeners);
      delete timers[id];

      if (eventTimerId && Object.keys(timers).length === 0) {
        // No more watchers, so stop firing 'devicemotion' events
        window.clearInterval(eventTimerId);
        eventTimerId = null;
      }
    }
  }
};
module.exports = devicemotion;
