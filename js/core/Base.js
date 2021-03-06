define(["inherit"], function(inherit){

    var cid = 0;

    var Base = inherit.Base.inherit("js.core.Base",{

        ctor: function () {
            // generate unique id
            this.$cid = ++cid;

        },

        /***
         * determinate if the application runs in the browser or on node
         *
         * @return {Boolean} true if the application runs in a browser
         */
        runsInBrowser: function () {
            return typeof window !== "undefined";
        },

        /***
         * logs messages to configured logging functions
         *
         * @param {String|Array} message the message to log
         * @param {String} [level="info"] the service level of (debug, info, warn, error)
         */
        log: function(message, level) {
            level = level || Base.LOGLEVEL.INFO;

            if (message instanceof Error) {
                message = message.toString();
            }

            if (Base.logger.length) {
                for (var i = 0; i < Base.logger.length; i++) {
                    Base.logger[i].log(message, level);
                }
            } else if (typeof console !== "undefined") {
                (console[level] || console.log).call(console, message);
            }
        }
    });

    Base.logger = [];
    Base.LOGLEVEL = {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };

    return Base;
});